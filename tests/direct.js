import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

// Metrics - RESEARCH FOCUS
const firstByteTrend = new Trend('ttfb_ms');      
const connectionTrend = new Trend('connection_ms');
const dnsTrend = new Trend('dns_ms');
const errorRate = new Rate('error_rate');
const requestCounter = new Counter('request_count');

const BASE_URL = 'http://localhost:8030';

const AUDIO_POOL = [
    'part_A_1.mp3',
    'part_A_2.mp3', 
    'part_A_3.mp3',
    'part_B_1.mp3',
    'part_C_1.mp3',
];

function getUserSessionFiles() {
    const shuffled = [...AUDIO_POOL].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 2 + Math.floor(Math.random() * 2)); 
}

export const options = {
    scenarios: {
        baseline: {
            executor: 'constant-vus',
            vus: 10,
            duration: '2m',
            exec: 'assessmentSession',
        },
        cooldown_1: {
            executor: 'constant-vus',
            vus: 1,
            duration: '2m',
            startTime: '2m',
            exec: 'cooldown'
        },
        target_load: {
            executor: 'constant-vus',
            vus: 200,
            duration: '5m',
            startTime: '4m',
            exec: 'assessmentSession',
        },
        cooldown_2: {
            executor: 'constant-vus',
            vus: 1,
            duration: '2m',
            startTime: '9m',
            exec: 'cooldown'
        },
        ramp_to_failure: {
            executor: 'ramping-vus',
            startVUs: 50,
            stages: [
                { duration: '2m', target: 200 },
                { duration: '2m', target: 400 },
                { duration: '2m', target: 500 }, 
            ],
            startTime: '11m',
            exec: 'assessmentSession',
        },
    },
    thresholds: {
        'error_rate': ['rate<0.01'],
        'ttfb_ms': ['p(95)<200'], 
    },
};

// Core logic: Measure the first chunk with custom tags
function streamAudioChunk(url, fileName) {
    const params = {
        headers: {
            'Range': 'bytes=0-65535', 
            'Accept': 'audio/mpeg',
        },
        // TAGS: This attaches the filename to every metric recorded in this request
        tags: { 
            question_name: fileName,
            type: 'audio_stream' 
        },
    };

    const response = http.get(url, params);
    
    const success = check(response, {
        'status is 206': (r) => r.status === 206,
    });
    
    errorRate.add(!success, { question_name: fileName });
    requestCounter.add(1, { question_name: fileName });
    
    if (success) {
        // Record trends with the same tags for granular analysis
        firstByteTrend.add(response.timings.waiting, { question_name: fileName });
        connectionTrend.add(response.timings.connecting, { question_name: fileName });
        dnsTrend.add(response.timings.blocked, { question_name: fileName });
    }
    
    return success;
}

export function assessmentSession() {
    const files = getUserSessionFiles();
    
    for (const file of files) {
        streamAudioChunk(`${BASE_URL}/audio/${file}`, file);
        
        // Realistic listening "Think Time"
        sleep(10 + Math.random() * 10);
    }
}

export function cooldown() {
    sleep(120);
}