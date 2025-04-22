const localVideo = document.getElementById("localVideo");
const remoteVideos = document.getElementById("remoteVideos");
const toggleMicBtn = document.getElementById("toggleMic");
const hangupBtn = document.getElementById("hangup");

let localStream;
let peers = {};
let isMicMuted = false;

const id = Math.floor(Math.random() * 10000).toString();

// WebSocket para sinalização
const signalingServer = new WebSocket("wss://webrole.onrender.com");

signalingServer.onopen = () => {
  signalingServer.send(JSON.stringify({ type: "join", from: id }));
};

signalingServer.onmessage = async (message) => {
  const data = JSON.parse(message.data);
  const { from, type, offer, answer, candidate, peers: joinedPeers } = data;

  if (from === id) return;

  switch (type) {
    case "join":
      // Quando outro usuário entra, criamos uma conexão com ele
      if (!peers[from]) {
        const peer = createPeerConnection(from);
        peers[from] = peer;

        const offerDesc = await peer.createOffer();
        await peer.setLocalDescription(offerDesc);

        signalingServer.send(JSON.stringify({
          to: from,
          from: id,
          type: "offer",
          offer: offerDesc
        }));
      }
      break;

    case "offer":
      if (!peers[from]) {
        const peer = createPeerConnection(from);
        peers[from] = peer;
      }

      await peers[from].setRemoteDescription(new RTCSessionDescription(offer));
      const answerDesc = await peers[from].createAnswer();
      await peers[from].setLocalDescription(answerDesc);

      signalingServer.send(JSON.stringify({
        to: from,
        from: id,
        type: "answer",
        answer: answerDesc
      }));
      break;

    case "answer":
      await peers[from].setRemoteDescription(new RTCSessionDescription(answer));
      break;

    case "candidate":
      if (peers[from]) {
        await peers[from].addIceCandidate(new RTCIceCandidate(candidate));
      }
      break;
  }
};

navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
  localVideo.srcObject = stream;
  localStream = stream;
}).catch((error) => {
  alert("Erro ao acessar câmera/microfone: " + error.message);
});

function createPeerConnection(peerId) {
  const peer = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  // Enviar áudio e vídeo local
  localStream.getTracks().forEach((track) => {
    peer.addTrack(track, localStream);
  });

  peer.onicecandidate = (event) => {
    if (event.candidate) {
      signalingServer.send(JSON.stringify({
        to: peerId,
        from: id,
        type: "candidate",
        candidate: event.candidate
      }));
    }
  };

  peer.ontrack = (event) => {
    let remoteVideo = document.getElementById("video-" + peerId);

    if (!remoteVideo) {
      if (remoteVideos.childElementCount >= 3) return; // máximo de 3 vídeos remotos
      remoteVideo = document.createElement("video");
      remoteVideo.id = "video-" + peerId;
      remoteVideo.autoplay = true;
      remoteVideo.playsInline = true;
      remoteVideo.srcObject = new MediaStream();
      remoteVideos.appendChild(remoteVideo);
    }

    event.streams[0].getTracks().forEach((track) => {
      remoteVideo.srcObject.addTrack(track);
    });
  };

  return peer;
}

toggleMicBtn.onclick = () => {
  isMicMuted = !isMicMuted;
  localStream.getAudioTracks().forEach((track) => {
    track.enabled = !isMicMuted;
  });
  toggleMicBtn.textContent = isMicMuted ? "Ativar Microfone" : "Mutar Microfone";
};

hangupBtn.onclick = () => {
  Object.values(peers).forEach((peer) => peer.close());
  remoteVideos.innerHTML = "";
  signalingServer.close();
  alert("Chamada encerrada.");
};
