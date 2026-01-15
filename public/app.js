const socket = io();

const online = document.getElementById("online");
const connections = document.getElementById("connections");
const matches = document.getElementById("matches");
const messages = document.getElementById("messages");
const reports = document.getElementById("reports");

const status = document.getElementById("status");
const nameTag = document.getElementById("name");
const timer = document.getElementById("timer");
const typing = document.getElementById("typing");
const chat = document.getElementById("chat");
const msg = document.getElementById("msg");
const send = document.getElementById("send");
const next = document.getElementById("next");
const report = document.getElementById("report");

let myName = "";
let strangerName = "";
let typingTimeout = null;
let timerInterval = null;
let seconds = 0;

function add(text, type) {
  const d = document.createElement("div");
  d.classList.add("msg");
  d.classList.add(type);
  d.textContent = text;
  chat.appendChild(d);
  chat.scrollTop = chat.scrollHeight;
}

function startTimer() {
  clearInterval(timerInterval);
  seconds = 0;
  timerInterval = setInterval(() => {
    seconds++;
    const min = String(Math.floor(seconds / 60)).padStart(2, "0");
    const sec = String(seconds % 60).padStart(2, "0");
    timer.textContent = "Chat time: " + min + ":" + sec;
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timer.textContent = "";
}

// Your name
socket.on("yourName", (n) => {
  myName = n;
  nameTag.textContent = "You are: " + myName;
});

// Online count
socket.on("online", (count) => {
  online.textContent = "Online: " + count;
});

// Analytics stats
socket.on("stats", (data) => {
  connections.textContent = "Total Connections: " + data.totalConnections;
  matches.textContent = "Total Matches: " + data.totalMatches;
  messages.textContent = "Total Messages: " + data.totalMessages;
  reports.textContent = "Total Reports: " + data.totalReports;
});

// Waiting
socket.on("waiting", () => {
  status.textContent = "Searching for a stranger...";
  typing.textContent = "";
  msg.disabled = true;
  send.disabled = true;
  chat.innerHTML = "";
  stopTimer();
});

// Matched
socket.on("matched", (data) => {
  myName = data.you;
  strangerName = data.stranger;
  status.textContent = "Connected with " + strangerName;
  typing.textContent = "";
  msg.disabled = false;
  send.disabled = false;
  chat.innerHTML = "";
  startTimer();
});

// Message receive
socket.on("message", (m) => {
  add(strangerName + ": " + m, "stranger");
});

// Partner left
socket.on("partnerLeft", () => {
  status.textContent = "Partner left. Searching again...";
  typing.textContent = "";
  msg.disabled = true;
  send.disabled = true;
  chat.innerHTML = "";
  stopTimer();
});

// Typing
socket.on("typing", () => {
  typing.textContent = strangerName + " is typing...";
});

socket.on("stopTyping", () => {
  typing.textContent = "";
});

// Send
send.onclick = () => {
  const text = msg.value.trim();
  if (!text) return;
  if (text.length > 200) return alert("Max 200 characters");

  add(myName + ": " + text, "me");
  socket.emit("message", text);
  socket.emit("stopTyping");
  typing.textContent = "";
  msg.value = "";
};

// Typing detection
msg.addEventListener("input", () => {
  socket.emit("typing");
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => socket.emit("stopTyping"), 800);
});

// Next
next.onclick = () => {
  socket.emit("next");
  chat.innerHTML = "";
  stopTimer();
};

// Report
report.onclick = () => {
  socket.emit("report");
  alert("User reported. You will be matched with a new stranger.");
  socket.emit("next");
  stopTimer();
};
