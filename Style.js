// Determine WebSocket protocol (ws:// or wss://)
const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
const socket = new WebSocket(protocol + window.location.host);

let localStream;
let peerConnection;
let dataChannel;

const configuration = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] // Free STUN server for connection
};

// Select HTML elements
const statusDiv = document.getElementById('status');
const chatBox = document.getElementById('chatBox');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const startCallBtn = document.getElementById('startCallBtn');
const endCallBtn = document.getElementById('endCallBtn');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const imageInput = document.getElementById('imageInput');

// WebSocket connection opened
socket.onopen = () => {
    statusDiv.textContent = 'Status: Connected to Server';
    setupPeerConnection();
};

// Receive messages or data from the server
socket.onmessage = async (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'error') {
        alert(data.message);
        return;
    }

    if (data.offer) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.send(JSON.stringify({ answer }));
    } else if (data.answer) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    } else if (data.candidate) {
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
            console.error('ICE Candidate Error:', e);
        }
    }
};

// Setup WebRTC Peer Connection
function setupPeerConnection() {
    peerConnection = new RTCPeerConnection(configuration);

    // Create data channel for chat and image sharing
    dataChannel = peerConnection.createDataChannel('chatChannel');
    setupDataChannel(dataChannel);

    peerConnection.ondatachannel = (event) => {
        setupDataChannel(event.channel);
    };

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.send(JSON.stringify({ candidate: event.candidate }));
        }
    };

    peerConnection.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
    };
}

// Manage the data channel
function setupDataChannel(channel) {
    dataChannel = channel;
    dataChannel.onopen = () => {
        statusDiv.textContent = 'Status: Direct P2P Connection Established Between Both Phones';
    };
    dataChannel.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'text') {
            appendMessage(data.content, 'received');
        } else if (data.type === 'image') {
            appendImage(data.content, 'received');
        }
    };
}

// Send text message
sendBtn.onclick = () => {
    const text = messageInput.value.trim();
    if (text && dataChannel && dataChannel.readyState === 'open') {
        dataChannel.send(JSON.stringify({ type: 'text', content: text }));
        appendMessage(text, 'sent');
        messageInput.value = '';
    }
};

// Send photo/image
imageInput.onchange = (e) => {
    const file = e.target.files[0];
    if (file && dataChannel && dataChannel.readyState === 'open') {
        const reader = new FileReader();
        reader.onload = (event) => {
            const base64Data = event.target.result;
            dataChannel.send(JSON.stringify({ type: 'image', content: base64Data }));
            appendImage(base64Data, 'sent');
        };
        reader.readAsDataURL(file);
    }
};

// Start video/audio call
startCallBtn.onclick = async () => {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;

        localStream.getTracks().forEach((track) => {
            peerConnection.addTrack(track, localStream);
        });

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.send(JSON.stringify({ offer }));

        startCallBtn.disabled = true;
        endCallBtn.disabled = false;
    } catch (err) {
        alert('Camera/Microphone permission denied.');
    }
};

// End call
endCallBtn.onclick = () => {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    localVideo.srcObject = null;
    remoteVideo.srcObject = null;
    startCallBtn.disabled = false;
    endCallBtn.disabled = true;
};

// Functions to display messages on screen
function appendMessage(text, side) {
    const div = document.createElement('div');
    div.className = `message ${side}`;
    div.textContent = text;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function appendImage(src, side) {
    const div = document.createElement('div');
    div.className = `message ${side}`;
    const img = document.createElement('img');
    img.src = src;
    img.className = 'chat-img';
    div.appendChild(img);
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}
