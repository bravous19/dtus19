

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  getMessaging,
  getToken,
  onMessage
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js";

import { firebaseConfig, VAPID_KEY } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const messaging = getMessaging(app);

const PIN = "151224";

// ---------------- USER IDENTITY (A / B) ----------------
// Automatically assigns User A to the first tab and User B to the second tab.
// sessionStorage is unique per tab, while localStorage is shared across tabs.
let currentUser = sessionStorage.getItem("chatUser");

if (!currentUser) {
  const activeTabCount = Number(localStorage.getItem("activeTabCount") || "0");

  if (activeTabCount === 0) {
    currentUser = "A";
  } else {
    currentUser = "B";
  }

  sessionStorage.setItem("chatUser", currentUser);
  localStorage.setItem("activeTabCount", String(activeTabCount + 1));

  // Reduce count when tab is closed.
  window.addEventListener("beforeunload", () => {
    const count = Number(localStorage.getItem("activeTabCount") || "1");
    localStorage.setItem("activeTabCount", String(Math.max(0, count - 1)));
  });
}

console.log("Logged in as User", currentUser);

// ---------------- LOGIN ----------------
document.getElementById("loginBtn").onclick = () => {
  const pin = document.getElementById("pinInput").value;
  if (pin !== PIN) return alert("Wrong PIN");

  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("chatScreen").classList.remove("hidden");

  // Start realtime chat only after login.
  listenMessages();
};

// ---------------- SEND MESSAGE ----------------
document.getElementById("sendBtn").onclick = async () => {
  const input = document.getElementById("messageInput");
  const fileInput = document.getElementById("fileInput");

  const text = input.value.trim();
  const file = fileInput.files[0];

  if (!text && !file) return;

  const msg = {
    sender: currentUser,
    createdAt: serverTimestamp(),
    readBy: [currentUser]
  };

  if (file) {
    const base64 = await toBase64(file);
    msg.type = file.type.startsWith("image") ? "image" : "video";
    msg.fileData = base64;
  } else {
    msg.type = "text";
    msg.text = text;
  }

  await addDoc(collection(db, "messages"), msg);

  input.value = "";
  fileInput.value = "";
};

// ---------------- REALTIME CHAT ----------------
function listenMessages() {
  const q = query(collection(db, "messages"), orderBy("createdAt", "asc"));

  onSnapshot(q, async (snapshot) => {
    const box = document.getElementById("messages");
    box.innerHTML = "";

    for (const documentSnapshot of snapshot.docs) {
      const data = documentSnapshot.data();
      render(data);

      // Mark messages from the other user as read.
      if (data.sender !== currentUser) {
        const readBy = data.readBy || [];

        if (!readBy.includes(currentUser)) {
          const { updateDoc, doc, arrayUnion } = await import(
            "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"
          );

          await updateDoc(
            doc(db, "messages", documentSnapshot.id),
            {
              readBy: arrayUnion(currentUser)
            }
          );
        }
      }
    }

    box.scrollTop = box.scrollHeight;

    if (Notification.permission === "granted" && document.hidden) {
      const last = snapshot.docs[snapshot.docs.length - 1];
      if (last) {
        new Notification("New Message", {
          body: last.data().text || "Media message"
        });
      }
    }
  });
}

// ---------------- ZIG ZAG RENDER ----------------
function render(msg) {
  const div = document.createElement("div");
  const isMe = msg.sender === currentUser;

  div.className = `message ${isMe ? "right" : "left"}`;

  let content = "";

  if (msg.type === "text") {
    content = `<div class="message-content">${escapeHtml(msg.text || "")}</div>`;
  }

  if (msg.type === "image") {
    content = `<img src="${msg.fileData}">`;
  }

  if (msg.type === "video") {
    content = `<video controls src="${msg.fileData}"></video>`;
  }

  const sentTime = msg.createdAt?.toDate
    ? msg.createdAt.toDate()
    : null;

  const timeText = sentTime
    ? sentTime.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      })
    : "Sending...";

  const readStatus = isMe && (msg.readBy || []).length >= 2
    ? "Read"
    : isMe
      ? "Sent"
      : "";

  div.innerHTML = `
    ${content}
    <div class="message-meta">
      <span class="message-time">${timeText}</span>
      ${readStatus ? `<span class="message-read">• ${readStatus}</span>` : ""}
    </div>
  `;

  document.getElementById("messages").appendChild(div);
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ---------------- BASE64 ----------------
function toBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

// ---------------- NOTIFICATIONS ----------------
async function initNotifications() {
  if (!("Notification" in window)) return;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return;

  if ("serviceWorker" in navigator) {
    const reg = await navigator.serviceWorker.register("./sw.js");

    try {
      const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: reg
      });

      if (token) {
        console.log("FCM Token:", token);

        await addDoc(collection(db, "fcmTokens"), {
          token,
          user: currentUser,
          createdAt: serverTimestamp()
        });
      }
    } catch (e) {
      console.log("FCM token error", e);
    }
  }

  onMessage(messaging, (payload) => {
    console.log("Foreground push", payload);
  });
}
// ---------------- AUTO INITIALIZE NOTIFICATIONS ----------------
// Runs when the website loads, even before PIN login.
window.addEventListener("load", async () => {
  await initNotifications();
});
