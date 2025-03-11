import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import { Badge, IconButton, TextField } from "@mui/material";
import { Button } from "@mui/material";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import styles from "../styles/videoComponent.module.css";
import CallEndIcon from "@mui/icons-material/CallEnd";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import ScreenShareIcon from "@mui/icons-material/ScreenShare";
import StopScreenShareIcon from "@mui/icons-material/StopScreenShare";
import ChatIcon from "@mui/icons-material/Chat";
// import server from "../environment"

var connections = {};

const peerConfigConnections = {
  "iceServers": [{ "urls": "stun:stun.l.google.com:19302" }],
};

export default function VideoMeetComponent() {
  var socketRef = useRef();
  let socketIdRef = useRef();
  let localVideoref = useRef();

  let [videoAvailable, setVideoAvailable] = useState(true);
  let [audioAvailable, setAudioAvailable] = useState(true);

  let [video, setVideo] = useState(true); // Set to true by default to show preview
  let [audio, setAudio] = useState(true); // Set to true by default
  let [screen, setScreen] = useState(false);

  let [showModal, setModal] = useState(false);

  let [screenAvailable, setScreenAvailable] = useState(false);

  let [messages, setMessages] = useState([]);
  let [message, setMessage] = useState("");
  let [newMessages, setNewMessages] = useState(0);

  let [askForUsername, setAskForUsername] = useState(true);

  let [username, setUsername] = useState("");

  let [videos, setVideos] = useState([]);

  // Store room ID from URL
  const roomId = useRef(window.location.pathname.split("/").pop() || window.location.href);

  // Get initial media for preview
  useEffect(() => {
    // Initialize video preview when component mounts
    getInitialPreview();
  }, []);

  // Function to get initial preview before joining the call
  const getInitialPreview = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: videoAvailable,
        audio: false, // Don't enable audio in preview to avoid feedback
      });

      window.localStream = mediaStream;
      if (localVideoref.current) {
        localVideoref.current.srcObject = mediaStream;
      }

      // Set appropriate state for video/audio availability
      const videoTracks = mediaStream.getVideoTracks();
      setVideoAvailable(videoTracks.length > 0);

      // Check audio separately
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioStream.getTracks().forEach(track => track.stop()); // Stop tracks immediately
        setAudioAvailable(true);
      } catch (error) {
        console.log("Audio not available", error);
        setAudioAvailable(false);
      }

      // Check screen sharing capability
      setScreenAvailable(navigator.mediaDevices.getDisplayMedia !== undefined);
    } catch (error) {
      console.log("Error getting preview media:", error);
      setVideoAvailable(false);
    }
  };

  useEffect(() => {
    if (!askForUsername && (video !== undefined || audio !== undefined)) {
      getUserMedia();
    }
  }, [video, audio, askForUsername]);

  useEffect(() => {
    if (screen !== undefined) {
      getDislayMedia();
    }
  }, [screen]);

  const getMedia = () => {
    // Ensure we're using the latest video/audio state
    getUserMedia();
    connectToSocketServer();
  };

  const getUserMediaSuccess = stream => {
    try {
      if (window.localStream) {
        window.localStream.getTracks().forEach(track => track.stop());
      }
    } catch (e) {
      console.log("Error stopping previous stream:", e);
    }

    window.localStream = stream;
    if (localVideoref.current) {
      localVideoref.current.srcObject = stream;
    }

    // Enable or disable tracks based on current state
    stream.getVideoTracks().forEach(track => {
      track.enabled = video;
    });

    stream.getAudioTracks().forEach(track => {
      track.enabled = audio;
    });

    // Update connections with new stream
    updateAllConnections(stream);
  };

  const updateAllConnections = stream => {
    for (let id in connections) {
      if (id === socketIdRef.current) continue;

      try {
        // Remove any existing streams
        const senders = connections[id].getSenders();
        senders.forEach(sender => {
          if (sender.track) {
            connections[id].removeTrack(sender);
          }
        });

        // Add all tracks from the new stream
        stream.getTracks().forEach(track => {
          connections[id].addTrack(track, stream);
        });

        // Create and send new offer
        connections[id]
          .createOffer()
          .then(description => {
            connections[id]
              .setLocalDescription(description)
              .then(() => {
                socketRef.current.emit("signal", id, JSON.stringify({ "sdp": connections[id].localDescription }));
              })
              .catch(e => console.log("Error setting local description:", e));
          })
          .catch(e => console.log("Error creating offer:", e));
      } catch (e) {
        console.log("Error updating connection:", e);
      }
    }
  };

  const getUserMedia = () => {
    const constraints = {
      video: videoAvailable ? video : false,
      audio: audioAvailable ? audio : false,
    };

    if ((constraints.video || constraints.audio) && navigator.mediaDevices) {
      navigator.mediaDevices
        .getUserMedia(constraints)
        .then(getUserMediaSuccess)
        .catch(error => {
          console.log("Error getting user media:", error);
          // If we can't get both, try just one
          if (constraints.video && constraints.audio) {
            // Try video only
            navigator.mediaDevices
              .getUserMedia({ video: constraints.video, audio: false })
              .then(getUserMediaSuccess)
              .catch(e => {
                console.log("Error getting video only:", e);
                // Try audio only
                navigator.mediaDevices
                  .getUserMedia({ video: false, audio: constraints.audio })
                  .then(getUserMediaSuccess)
                  .catch(e => console.log("Error getting audio only:", e));
              });
          }
        });
    } else {
      try {
        if (localVideoref.current && localVideoref.current.srcObject) {
          const tracks = localVideoref.current.srcObject.getTracks();
          tracks.forEach(track => track.stop());
        }
      } catch (e) {
        console.log("Error stopping tracks:", e);
      }
    }
  };

  const getDislayMedia = () => {
    if (screen && navigator.mediaDevices.getDisplayMedia) {
      navigator.mediaDevices
        .getDisplayMedia({ video: true, audio: true })
        .then(getDislayMediaSuccess)
        .catch(e => console.log("Error getting display media:", e));
    }
  };

  const getDislayMediaSuccess = stream => {
    try {
      if (window.localStream) {
        // Only stop video tracks, keep audio tracks from the previous stream
        const videoTracks = window.localStream.getVideoTracks();
        videoTracks.forEach(track => track.stop());
      }
    } catch (e) {
      console.log("Error stopping previous stream:", e);
    }

    // Keep audio tracks from previous stream if they exist
    const audioTracks = window.localStream ? window.localStream.getAudioTracks() : [];

    // Create a new stream with screen video and existing audio
    const newStream = new MediaStream();

    // Add all tracks from screen share
    stream.getTracks().forEach(track => {
      newStream.addTrack(track);
    });

    // Add audio tracks from previous stream if they exist
    audioTracks.forEach(track => {
      newStream.addTrack(track);
    });

    window.localStream = newStream;
    if (localVideoref.current) {
      localVideoref.current.srcObject = newStream;
    }

    // Update connections with new stream
    updateAllConnections(newStream);

    // Handle screen share end
    stream.getVideoTracks()[0].onended = () => {
      setScreen(false);
      getUserMedia(); // Revert to camera
    };
  };

  const gotMessageFromServer = (fromId, message) => {
    // Ignore messages from ourselves
    if (fromId === socketIdRef.current) return;

    let signal;
    try {
      signal = JSON.parse(message);
    } catch (e) {
      console.log("Invalid signal received:", message);
      return;
    }

    // Make sure we have a connection for this peer
    if (!connections[fromId]) {
      console.log("Creating new connection for received signal from:", fromId);
      connections[fromId] = new RTCPeerConnection(peerConfigConnections);
      setupPeerConnection(fromId);
    }

    if (signal.sdp) {
      connections[fromId]
        .setRemoteDescription(new RTCSessionDescription(signal.sdp))
        .then(() => {
          if (signal.sdp.type === "offer") {
            connections[fromId]
              .createAnswer()
              .then(description => {
                connections[fromId]
                  .setLocalDescription(description)
                  .then(() => {
                    socketRef.current.emit("signal", fromId, JSON.stringify({ "sdp": connections[fromId].localDescription }));
                  })
                  .catch(e => console.log("Error setting local description:", e));
              })
              .catch(e => console.log("Error creating answer:", e));
          }
        })
        .catch(e => console.log("Error setting remote description:", e));
    }

    if (signal.ice) {
      connections[fromId].addIceCandidate(new RTCIceCandidate(signal.ice)).catch(e => console.log("Error adding ice candidate:", e));
    }
  };

  // Setup a peer connection
  const setupPeerConnection = id => {
    connections[id].onicecandidate = event => {
      if (event.candidate) {
        socketRef.current.emit("signal", id, JSON.stringify({ "ice": event.candidate }));
      }
    };

    connections[id].ontrack = event => {
      console.log("Got track from:", id, event.streams[0]);

      // Check if we already have this peer's video
      const existingVideoIndex = videos.findIndex(v => v.socketId === id);

      if (existingVideoIndex !== -1) {
        // Update existing video
        setVideos(prevVideos => {
          const updatedVideos = [...prevVideos];
          updatedVideos[existingVideoIndex].stream = event.streams[0];
          return updatedVideos;
        });
      } else {
        // Add new video
        const newVideo = {
          socketId: id,
          stream: event.streams[0],
          autoplay: true,
          playsinline: true,
        };

        setVideos(prevVideos => [...prevVideos, newVideo]);
      }
    };

    // Add our local stream
    if (window.localStream) {
      window.localStream.getTracks().forEach(track => {
        connections[id].addTrack(track, window.localStream);
      });
    }
  };

  const connectToSocketServer = () => {
    socketRef.current = io.connect("http://localhost:3000", { secure: false });

    socketRef.current.on("signal", gotMessageFromServer);

    socketRef.current.on("connect", () => {
      console.log("Connected to socket server, joining room:", roomId.current);
      socketRef.current.emit("join-call", roomId.current);
      socketIdRef.current = socketRef.current.id;

      socketRef.current.on("chat-message", addMessage);

      socketRef.current.on("user-left", id => {
        console.log("User left:", id);
        // Clean up the connection
        if (connections[id]) {
          connections[id].close();
          delete connections[id];
        }
        // Remove the video
        setVideos(videos => videos.filter(video => video.socketId !== id));
      });

      socketRef.current.on("user-joined", (id, clients) => {
        console.log("User joined, clients in room:", clients);

        // Handle each client in the room
        clients.forEach(clientId => {
          // Skip if it's our own id or if we already have a connection
          if (clientId === socketIdRef.current || connections[clientId]) return;

          console.log("Setting up connection to:", clientId);

          // Create new peer connection
          connections[clientId] = new RTCPeerConnection(peerConfigConnections);
          setupPeerConnection(clientId);

          // Create offer if we are the newer peer (compare socket IDs lexicographically)
          if (socketIdRef.current < clientId) {
            console.log("Creating offer to:", clientId);
            connections[clientId]
              .createOffer()
              .then(description => {
                connections[clientId]
                  .setLocalDescription(description)
                  .then(() => {
                    socketRef.current.emit("signal", clientId, JSON.stringify({ "sdp": connections[clientId].localDescription }));
                  })
                  .catch(e => console.log("Error setting local description:", e));
              })
              .catch(e => console.log("Error creating offer:", e));
          }
        });
      });
    });

    socketRef.current.on("disconnect", () => {
      console.log("Disconnected from socket server");
    });

    socketRef.current.on("error", error => {
      console.log("Socket error:", error);
    });
  };

  const silence = () => {
    let ctx = new AudioContext();
    let oscillator = ctx.createOscillator();
    let dst = oscillator.connect(ctx.createMediaStreamDestination());
    oscillator.start();
    ctx.resume();
    return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false });
  };

  const black = ({ width = 640, height = 480 } = {}) => {
    let canvas = Object.assign(document.createElement("canvas"), { width, height });
    canvas.getContext("2d").fillRect(0, 0, width, height);
    let stream = canvas.captureStream();
    return Object.assign(stream.getVideoTracks()[0], { enabled: false });
  };

  const handleVideo = () => {
    const newState = !video;
    setVideo(newState);

    if (localVideoref.current && localVideoref.current.srcObject) {
      localVideoref.current.srcObject.getVideoTracks().forEach(track => {
        track.enabled = newState;
      });
    }
  };

  const handleAudio = () => {
    const newState = !audio;
    setAudio(newState);

    if (localVideoref.current && localVideoref.current.srcObject) {
      localVideoref.current.srcObject.getAudioTracks().forEach(track => {
        track.enabled = newState;
      });
    }
  };

  const handleScreen = () => {
    setScreen(!screen);
  };

  const handleEndCall = () => {
    try {
      if (localVideoref.current && localVideoref.current.srcObject) {
        let tracks = localVideoref.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
      }
    } catch (e) {
      console.log("Error ending call:", e);
    }

    // Clean up all connections
    for (let id in connections) {
      if (connections[id]) {
        connections[id].close();
      }
    }
    connections = {};

    // Disconnect socket
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    window.location.href = "/";
  };

  const addMessage = (data, sender, socketIdSender) => {
    setMessages(prevMessages => [...prevMessages, { sender: sender, data: data }]);
    if (socketIdSender !== socketIdRef.current) {
      setNewMessages(prevNewMessages => prevNewMessages + 1);
    }
  };

  const sendMessage = () => {
    if (message.trim() !== "" && socketRef.current) {
      socketRef.current.emit("chat-message", message, username);
      setMessages(prevMessages => [...prevMessages, { sender: username, data: message }]);
      setMessage("");
    }
  };

  const connect = () => {
    if (username.trim() !== "") {
      setAskForUsername(false);
      getMedia();
    }
  };

  const handleKeyDown = e => {
    if (e.key === "Enter") {
      if (askForUsername) {
        connect();
      } else if (showModal) {
        sendMessage();
      }
    }
  };

  console.log("Current videos:", videos);

  return (
    <div>
      {askForUsername === true ? (
        <div className={styles.loginContainer || ""}>
          <h2>Enter into Lobby</h2>
          <TextField id="outlined-basic" label="Username" value={username} onChange={e => setUsername(e.target.value)} onKeyDown={handleKeyDown} variant="outlined" />
          <Button variant="contained" onClick={connect} disabled={!username.trim()}>
            Connect
          </Button>

          <div>
            <video ref={localVideoref} autoPlay muted style={{ width: "100%", maxWidth: "300px", marginTop: "20px" }}></video>
          </div>
        </div>
      ) : (
        <div className={styles.meetVideoContainer}>
          {showModal ? (
            <div className={styles.chatRoom}>
              <div className={styles.chatContainer}>
                <h1>Chat</h1>
                <Button variant="text" onClick={() => setModal(false)} style={{ position: "absolute", right: "10px", top: "10px" }}>
                  Close
                </Button>

                <div className={styles.chattingDisplay}>
                  {messages.length !== 0 ? (
                    messages.map((item, index) => (
                      <div style={{ marginBottom: "20px" }} key={index}>
                        <p style={{ fontWeight: "bold" }}>{item.sender}</p>
                        <p>{item.data}</p>
                      </div>
                    ))
                  ) : (
                    <p>No Messages Yet</p>
                  )}
                </div>

                <div className={styles.chattingArea}>
                  <TextField value={message} onChange={e => setMessage(e.target.value)} onKeyDown={handleKeyDown} id="standard-basic" label="Enter Your chat" variant="outlined" fullWidth />
                  <Button variant="contained" onClick={sendMessage} disabled={!message.trim()}>
                    Send
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          <div className={styles.buttonContainers}>
            <IconButton onClick={handleVideo} style={{ color: "white" }}>
              {video === true ? <VideocamIcon /> : <VideocamOffIcon />}
            </IconButton>
            <IconButton onClick={handleEndCall} style={{ color: "red" }}>
              <CallEndIcon />
            </IconButton>
            <IconButton onClick={handleAudio} style={{ color: "white" }}>
              {audio === true ? <MicIcon /> : <MicOffIcon />}
            </IconButton>

            {screenAvailable === true ? (
              <IconButton onClick={handleScreen} style={{ color: "white" }}>
                {screen === true ? <ScreenShareIcon /> : <StopScreenShareIcon />}
              </IconButton>
            ) : null}

            <Badge badgeContent={newMessages} max={999} color="secondary">
              <IconButton onClick={() => setModal(true)} style={{ color: "white" }}>
                <ChatIcon />
              </IconButton>
            </Badge>
          </div>

          <video className={styles.meetUserVideo} ref={localVideoref} autoPlay muted style={{ width: "300px", height: "225px", objectFit: "cover" }}></video>

          <div className={styles.conferenceView}>
            {videos.length > 0 ? (
              videos.map((video, index) => (
                <div key={video.socketId} className={styles.remoteVideo || ""}>
                  <video
                    data-socket={video.socketId}
                    ref={ref => {
                      if (ref && video.stream) {
                        ref.srcObject = video.stream;
                      }
                    }}
                    autoPlay
                    playsInline
                    style={{ width: "100%", maxHeight: "300px", objectFit: "cover" }}
                  ></video>
                </div>
              ))
            ) : (
              <div className={styles.noRemoteUsers}>
                <p>Waiting for others to join...</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
