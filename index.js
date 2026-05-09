const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

exports.sendChatNotification = functions.firestore
  .document("messages/{messageId}")
  .onCreate(async (snap) => {
    const msg = snap.data();

    const tokensSnapshot = await admin
      .firestore()
      .collection("fcmTokens")
      .get();

    const tokens = [];

    tokensSnapshot.forEach((doc) => {
      const token = doc.data().token;
      if (token) tokens.push(token);
    });

    if (!tokens.length) {
      return null;
    }

    const notification = {
      title: "New Message",
      body: msg.text || "New message!!"
    };

    await admin.messaging().sendEachForMulticast({
      tokens,
      notification
    });

    return null;
  });
