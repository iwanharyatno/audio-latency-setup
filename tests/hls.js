import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

// Metrics - RESEARCH FOCUS
const playlistTtfbTrend = new Trend('hls_playlist_ttfb_ms');
const firstSegmentTtfbTrend = new Trend('hls_first_segment_ttfb_ms');
const totalStartTrend = new Trend('hls_total_start_time_ms'); // playlist + 1st segment
const dnsTrend = new Trend('dns_lookup_ms');      // CDN benefit proof (blocked)
const connectionTrend = new Trend('connection_ms'); // TCP/TLS handshake
const errorRate = new Rate('error_rate');

const BASE_URL = 'http://localhost:8031'; // Using HLS port from docker-compose

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
        'hls_total_start_time_ms': ['p(95)<400'], 
    },
};

function streamHlsStart(folderName) {
    const startTime = Date.now();
    const tag = { question_name: folderName };
    
    // 1. Fetch playlist
    const playlistRes = http.get(`${BASE_URL}/audio/${folderName}/playlist.m3u8`, {
        headers: { 'Accept': 'application/vnd.apple.mpegurl' },
        tags: Object.assign({ name: 'hls_playlist' }, tag),
    });
    
    const playlistOk = check(playlistRes, { 'playlist status 200': (r) => r.status === 200 });
    
    if (!playlistOk) {
        errorRate.add(1, tag);
        return false;
    }
    
    // Record Playlist Metrics
    playlistTtfbTrend.add(playlistRes.timings.waiting, tag);
    dnsTrend.add(playlistRes.timings.blocked, tag);
    connectionTrend.add(playlistRes.timings.connecting, tag);
    
    // 2. Simple Parse for first segment
    const lines = playlistRes.body.split('\n');
    const firstSegment = lines.find(line => line.trim().endsWith('.ts') || line.trim().includes('segment_'));
    
    if (!firstSegment) {
        errorRate.add(1, tag);
        return false;
    }
    
    // Construct segment URL (handling relative paths in manifest)
    const segmentUrl = firstSegment.startsWith('http') 
        ? firstSegment 
        : `${BASE_URL}/audio/${folderName}/${firstSegment.trim()}`;
    
    // 3. Fetch ONLY first segment
    const segmentRes = http.get(segmentUrl, {
        tags: Object.assign({ name: 'hls_first_segment' }, tag),
    });
    
    const segmentOk = check(segmentRes, { 'segment status 200': (r) => r.status === 200 });
    
    errorRate.add(!segmentOk, tag);
    
    if (segmentOk) {
        firstSegmentTtfbTrend.add(segmentRes.timings.waiting, tag);
        dnsTrend.add(segmentRes.timings.blocked, tag);
        connectionTrend.add(segmentRes.timings.connecting, tag);
        totalStartTrend.add(Date.now() - startTime, tag);
    }
    
    return segmentOk;
}

export function assessmentSession() {
    const files = getUserSessionFiles();
    
    for (const file of files) {
        streamHlsStart(file);
        // Simulate listening time
        sleep(15 + Math.random() * 15);
    }
}

export function cooldown() {
    sleep(120);
}