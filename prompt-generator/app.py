import os
import logging
from flask import Flask, jsonify, request
from flask_restful import Api, Resource, reqparse
from flask_cors import CORS
import torch

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask("PromptGeneratorAPI")

# Configure CORS properly - allow all origins for testing
CORS(app, origins="*", supports_credentials=True, 
     allow_headers=["Content-Type", "Authorization", "ngrok-skip-browser-warning"])

api = Api(app)

# Try to load model at startup
logger.info("Attempting to load model...")
model = None
tokenizer = None

try:
    from transformers import GPT2Tokenizer, GPT2LMHeadModel
    
    logger.info("Loading tokenizer...")
    tokenizer = GPT2Tokenizer.from_pretrained('distilgpt2')
    tokenizer.add_special_tokens({'pad_token': '[PAD]'})
    
    logger.info("Loading model...")
    model = GPT2LMHeadModel.from_pretrained('FredZhang7/distilgpt2-stable-diffusion-v2')
    model = model.to('cpu')
    model.eval()
    logger.info("✅ Model loaded successfully!")
except Exception as e:
    logger.error(f"❌ Failed to load model: {e}")
    model = None
    tokenizer = None

# Root endpoint to check if Flask is running
@app.route('/', methods=['GET'])
def root():
    return jsonify({
        "status": "Flask app is running",
        "endpoints": ["/health", "/api/health", "/generate", "/api/generate"]
    })

# Health check endpoint - at root
@app.route('/health', methods=['GET', 'OPTIONS'])
def health():
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        return response, 200
    
    logger.info("Health check endpoint called")
    return jsonify({
        "status": "healthy", 
        "model_loaded": model is not None,
        "tokenizer_loaded": tokenizer is not None
    })

# Also add /api/health endpoint to match what your frontend expects
@app.route('/api/health', methods=['GET', 'OPTIONS'])
def api_health():
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        return response, 200
    
    logger.info("API Health check endpoint called")
    return jsonify({
        "status": "healthy", 
        "model_loaded": model is not None,
        "tokenizer_loaded": tokenizer is not None
    })

class PromptGenerator(Resource):
    def options(self):
        return '', 200
    
    def post(self):
        try:
            parser = reqparse.RequestParser()
            parser.add_argument('prompt', required=True, type=str)
            parser.add_argument('temperature', type=float, default=0.9)
            parser.add_argument('top_k', type=int, default=8)
            parser.add_argument('max_length', type=int, default=80)
            parser.add_argument('num_return_sequences', type=int, default=3)
            
            args = parser.parse_args()
            logger.info(f"Received prompt: {args['prompt']}")
            
            if model is None or tokenizer is None:
                logger.error("Model not loaded")
                return {"error": "Model not loaded"}, 503
            
            with torch.no_grad():
                input_ids = tokenizer(args['prompt'], return_tensors='pt').input_ids
                
                # Limit input size
                if input_ids.shape[1] > 50:
                    input_ids = input_ids[:, :50]
                
                outputs = model.generate(
                    input_ids,
                    do_sample=True,
                    temperature=args['temperature'],
                    top_k=args['top_k'],
                    max_length=min(args['max_length'], 100),
                    num_return_sequences=min(args['num_return_sequences'], 3),
                    repetition_penalty=1.2,
                    pad_token_id=tokenizer.pad_token_id,
                    eos_token_id=tokenizer.eos_token_id
                )
                
                prompts = []
                for output in outputs:
                    decoded = tokenizer.decode(output, skip_special_tokens=True)
                    prompts.append(decoded)
                
                logger.info(f"Generated {len(prompts)} prompts")
                return prompts
                
        except Exception as e:
            logger.error(f"Generation error: {e}")
            return {"error": str(e)}, 500

api.add_resource(PromptGenerator, '/generate')

# Also add /api/generate endpoint for consistency
@app.route('/api/generate', methods=['POST', 'OPTIONS'])
def api_generate():
    if request.method == 'OPTIONS':
        return '', 200
    
    try:
        data = request.get_json()
        prompt = data.get('prompt', '')
        temperature = data.get('temperature', 0.9)
        top_k = data.get('top_k', 8)
        max_length = data.get('max_length', 80)
        num_return_sequences = data.get('num_return_sequences', 3)
        
        logger.info(f"API Generate called with prompt: {prompt}")
        
        if model is None or tokenizer is None:
            return jsonify({"error": "Model not loaded"}), 503
        
        with torch.no_grad():
            input_ids = tokenizer(prompt, return_tensors='pt').input_ids
            
            if input_ids.shape[1] > 50:
                input_ids = input_ids[:, :50]
            
            outputs = model.generate(
                input_ids,
                do_sample=True,
                temperature=temperature,
                top_k=top_k,
                max_length=min(max_length, 100),
                num_return_sequences=min(num_return_sequences, 3),
                repetition_penalty=1.2,
                pad_token_id=tokenizer.pad_token_id,
                eos_token_id=tokenizer.eos_token_id
            )
            
            prompts = []
            for output in outputs:
                decoded = tokenizer.decode(output, skip_special_tokens=True)
                prompts.append(decoded)
            
            return jsonify(prompts)
            
    except Exception as e:
        logger.error(f"Generation error: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)  # Set debug=True for more logs