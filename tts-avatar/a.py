from flask import Flask, jsonify,render_template,send_file, request
import json
import logging
import os
import sys
import time
import uuid
from azure.identity import DefaultAzureCredential
import requests

app = Flask(__name__)
logging.basicConfig(stream=sys.stdout, level=logging.INFO,
        format="[%(asctime)s] %(message)s", datefmt="%m/%d/%Y %I:%M:%S %p %Z")
logger = logging.getLogger(__name__)

# Azure Speech Service Configuration
SPEECH_ENDPOINT = os.getenv('SPEECH_ENDPOINT', "https://southeastasia.api.cognitive.microsoft.com")
PASSWORDLESS_AUTHENTICATION = False
API_VERSION = "2024-04-15-preview"

def _create_job_id():
    return uuid.uuid4()

def _authenticate():
    if PASSWORDLESS_AUTHENTICATION:
        credential = DefaultAzureCredential()
        token = credential.get_token('https://cognitiveservices.azure.com/.default')
        return {'Authorization': f'Bearer {token.token}'}
    else:
        SUBSCRIPTION_KEY = os.getenv("SUBSCRIPTION_KEY", 'd21a028b925c4d4f84cff3796ecad2ac')
        return {'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY}

def submit_synthesis(job_id: str):
    url = f'{SPEECH_ENDPOINT}/avatar/batchsyntheses/{job_id}?api-version={API_VERSION}'
    header = {'Content-Type': 'application/json'}
    header.update(_authenticate())
    
    payload = {
        'synthesisConfig': {"voice": 'en-US-JennyMultilingualNeural'},
        "inputKind": "plainText",
        "inputs": [{"content": "Hi, I'm a virtual assistant created by Microsoft."}],
        "avatarConfig": {
            "talkingAvatarCharacter": 'Lisa',
            "videoFormat": "mp4",
            "videoCodec": "h264",
            "subtitleType": "soft_embedded",
            "backgroundColor": "#FFFFFFFF"
        }
    }
    response = requests.put(url, json.dumps(payload), headers=header)
    if response.status_code < 400:
        logger.info('Batch avatar synthesis job submitted successfully')
        return job_id
    else:
        logger.error(f'Failed to submit job: {response.status_code} - {response.text}')
        return None

def get_synthesis(job_id):
    url = f'{SPEECH_ENDPOINT}/avatar/batchsyntheses/{job_id}?api-version={API_VERSION}'
    header = _authenticate()
    response = requests.get(url, headers=header)
    if response.status_code < 400:
        status = response.json()['status']
        if status == 'Succeeded':
            return response.json()['outputs']['result']
        return status
    else:
        logger.error(f'Failed to get job: {response.status_code} - {response.text}')
        return None
    
@app.route('/')
def home():
    return render_template('index.html')


@app.route('/synthesize', methods=['POST'])
def synthesize():
    job_id = str(_create_job_id())
    if submit_synthesis(job_id):
        while True:
            status = get_synthesis(job_id)
            if status == 'Succeeded':
                video_url = status
                logger.info(f'Job succeeded: {video_url}')
                return jsonify({'status': 'success', 'video_url': video_url})
            elif status == 'Failed':
                return jsonify({'status': 'failed'})
            else:
                logger.info(f'Job in progress: {status}')
                time.sleep(5)

@app.route('/play_video', methods=['GET'])
def play_video():
    video_url = request.args.get('video_url')
    return send_file(video_url, mimetype='video/mp4')

if __name__ == '__main__':
    app.run(port=5000, debug=True)
