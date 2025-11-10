import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
// FIX: Corrected import from 'GoogleGenerativeAI' to 'GoogleGenAI' per SDK guidelines.
import { GoogleGenAI } from "@google/genai";

admin.initializeApp();

// Initialize the Gemini client. It will automatically use the API_KEY secret.
// Ensure the secret is set by running: firebase functions:secrets:set API_KEY
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error(
    "Gemini API key not found. Set the secret by running 'firebase functions:secrets:set API_KEY'"
  );
}

// FIX: Corrected constructor from 'GoogleGenerativeAI' to 'GoogleGenAI'.
const ai = new GoogleGenAI({ apiKey: API_KEY! });


export const askClinicalAssistant = functions.https.onCall(
  async (data, context) => {
    // Check if the user is authenticated.
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "The function must be called while authenticated."
      );
    }

    const query = data.query;
    if (!query || typeof query !== "string") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "The function must be called with a 'query' string argument."
      );
    }

    try {
        const result = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: query,
            config: {
                systemInstruction: `You are a clinical decision support assistant for Aegis Medical Solutions, a UK-based event medical provider. Your answers must be based on current UK clinical guidelines, primarily JRCALC. Do not provide a diagnosis. Your role is to provide information to trained clinicians to aid their decision-making, not to replace it. Always include a disclaimer at the end that the information is for guidance only and the clinician remains responsible for all patient care decisions.`,
            }
        });

      return { response: result.text };
    } catch (error) {
      console.error("Gemini API call failed:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Failed to get a response from the AI assistant."
      );
    }
  }
);

export const sendAnnouncement = functions.https.onCall(
  async (data, context) => {
    // Check auth
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "The function must be called while authenticated."
      );
    }
    
    // Check for manager/admin role
    const userDoc = await admin.firestore().collection("users").doc(context.auth.uid).get();
    const userData = userDoc.data();
    if (!userData || !['Manager', 'Admin'].includes(userData.role)) {
        throw new functions.https.HttpsError(
            "permission-denied",
            "User must be a Manager or Admin to send announcements."
        );
    }

    const message = data.message;
    const link = data.link;
    const target = data.target as {
        type: "all" | "roles" | "event";
        roles?: string[];
        eventName?: string;
    };

    if (!message || typeof message !== "string") {
        throw new functions.https.HttpsError(
            "invalid-argument",
            "The function must be called with a 'message' string argument."
        );
    }
    if (!target || !target.type) {
        throw new functions.https.HttpsError("invalid-argument", "A valid 'target' object must be provided.");
    }
    
    const db = admin.firestore();
    const uniqueUserIds = new Set<string>();

    if (target.type === "roles") {
        if (!target.roles || !Array.isArray(target.roles) || target.roles.length === 0) {
            throw new functions.https.HttpsError("invalid-argument", "Target type 'roles' requires a non-empty 'roles' array.");
        }
        const usersSnapshot = await db.collection("users").where("role", "in", target.roles).get();
        usersSnapshot.forEach((doc) => uniqueUserIds.add(doc.id));
    } else if (target.type === "event") {
        if (!target.eventName || typeof target.eventName !== "string") {
            throw new functions.https.HttpsError("invalid-argument", "Target type 'event' requires an 'eventName' string.");
        }
        const shiftsSnapshot = await db.collection("shifts").where("eventName", "==", target.eventName).get();
        shiftsSnapshot.forEach((doc) => {
            const shift = doc.data();
            if (shift.allAssignedStaffUids && Array.isArray(shift.allAssignedStaffUids)) {
                shift.allAssignedStaffUids.forEach((uid: string) => uniqueUserIds.add(uid));
            }
        });
    } else { // 'all'
        const usersSnapshot = await db.collection("users").get();
        usersSnapshot.forEach((doc) => {
            if (doc.data().role !== 'Pending') {
                uniqueUserIds.add(doc.id);
            }
        });
    }

    const userIds = Array.from(uniqueUserIds);
    if (userIds.length === 0) {
        console.log("No users found for the given target.");
        return { success: true, notificationsSent: 0 };
    }

    const senderName = (userData.firstName && userData.lastName) ? `${userData.firstName} ${userData.lastName}`.trim() : context.auth.token.name;
    const sender = {
        uid: context.auth.uid,
        name: senderName,
    };

    try {
        // Create Announcement Doc
        const announcementData = {
            message,
            sentBy: sender,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        await db.collection("announcements").add(announcementData);
        
        // Create in-app notifications
        const truncatedMessage = message.length > 50 ? message.substring(0, 50) + '...' : message;
        const notificationMessage = `New Hub Announcement: "${truncatedMessage}"`;
        const inAppPromises = [];
        let batch = db.batch();
        let count = 0;
        for (const userId of userIds) {
            const newNotifRef = db.collection("notifications").doc();
            batch.set(newNotifRef, {
                userId: userId,
                message: notificationMessage,
                read: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                link: link || '/dashboard',
            });
            count++;
            if (count === 499) { // Batch limit is 500 writes
                inAppPromises.push(batch.commit());
                batch = db.batch();
                count = 0;
            }
        }
        if (count > 0) {
            inAppPromises.push(batch.commit());
        }
        await Promise.all(inAppPromises);

        // Send FCM Push Notifications
        const tokensAndUsers: { token: string; userId: string }[] = [];
        const userDocsPromises = [];
        for (let i = 0; i < userIds.length; i += 30) { // Firestore 'in' query limit
            const chunk = userIds.slice(i, i + 30);
            userDocsPromises.push(db.collection('users').where(admin.firestore.FieldPath.documentId(), 'in', chunk).get());
        }
        const userDocsSnapshots = await Promise.all(userDocsPromises);
        userDocsSnapshots.forEach(snapshot => {
            snapshot.forEach(doc => {
                const docData = doc.data();
                if (docData.fcmTokens && Array.isArray(docData.fcmTokens)) {
                    docData.fcmTokens.forEach((token: string) => {
                        tokensAndUsers.push({ token, userId: doc.id });
                    });
                }
            });
        });

        const allTokens = tokensAndUsers.map(t => t.token);

        if (allTokens.length > 0) {
            const pushNotificationMessage = message.length > 100 ? message.substring(0, 97) + '...' : message;
            const payload = {
                notification: {
                    title: "Aegis Hub Announcement",
                    body: pushNotificationMessage,
                },
                webpush: {
                    fcmOptions: {
                        link: link || "https://aegis-staff-hub.web.app/"
                    }
                }
            };

            const CHUNK_SIZE = 500;
            for (let i = 0; i < allTokens.length; i += CHUNK_SIZE) {
                const chunk = allTokens.slice(i, i + CHUNK_SIZE);
                const response = await admin.messaging().sendEachForMulticast({ tokens: chunk, ...payload });

                const tokensToRemove: Promise<any>[] = [];
                response.responses.forEach((result, index) => {
                    const error = result.error;
                    if (error) {
                        const tokenIndex = i + index;
                        console.error('Failure sending notification to', allTokens[tokenIndex], error);
                        if (error.code === 'messaging/invalid-registration-token' ||
                            error.code === 'messaging/registration-token-not-registered') {
                            const staleToken = tokensAndUsers[tokenIndex];
                            tokensToRemove.push(
                                db.collection('users').doc(staleToken.userId).update({
                                    fcmTokens: admin.firestore.FieldValue.arrayRemove(staleToken.token)
                                })
                            );
                        }
                    }
                });
                await Promise.all(tokensToRemove);
            }
        }
        
        return { success: true, notificationsSent: userIds.length };

    } catch (error) {
        console.error("Failed to send announcement:", error);
        throw new functions.https.HttpsError(
            "internal",
            "Failed to send announcement."
        );
    }
  }
);


export const onUserUpdate = functions.firestore.document("users/{userId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const db = admin.firestore();
    
    const promises = [];

    // 1. Check for new role change request
    if (!before.pendingRole && after.pendingRole) {
      const usersSnapshot = await db.collection("users")
        .where("role", "in", ["Manager", "Admin"]).get();
      
      if (!usersSnapshot.empty) {
        const batch = db.batch();
        const notificationMessage = `${after.firstName} ${after.lastName} has requested a role change to ${after.pendingRole}.`;
        
        usersSnapshot.forEach(doc => {
          const newNotifRef = db.collection("notifications").doc();
          batch.set(newNotifRef, {
              userId: doc.id,
              message: notificationMessage,
              read: false,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              link: '/staff',
          });
        });
        promises.push(batch.commit());
      }
    }
    
    // 2. Check for role change resolution (approval or rejection)
    if (before.pendingRole && !after.pendingRole) {
        let message = '';
        if (before.role !== after.role) { // Approved
            message = `Your role has been updated to ${after.role}.`;
        } else { // Rejected
            message = `Your recent role change request was not approved.`;
        }

        const newNotifRef = db.collection("notifications").doc();
        promises.push(newNotifRef.set({
            userId: context.params.userId,
            message: message,
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            link: '/profile',
        }));
    }

    if (promises.length > 0) {
        await Promise.all(promises);
    }

    return null;
  });

export const onKudoCreate = functions.firestore.document("kudos/{kudoId}")
    .onCreate(async (snap) => {
        const kudo = snap.data();
        if (!kudo) return;

        const db = admin.firestore();
        const newNotifRef = db.collection("notifications").doc();

        await newNotifRef.set({
            userId: kudo.to.uid,
            message: `${kudo.from.name} sent you kudos!`,
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            link: '/wellbeing',
        });
    });

export const onEprfUpdate = functions.firestore.document("eprfs/{eprfId}")
  .onUpdate(async (change) => {
    const before = change.before.data();
    const after = change.after.data();
    
    // Check if ePRF was returned to draft
    if (before.status !== 'Draft' && after.status === 'Draft' && after.reviewNotes) {
      const db = admin.firestore();
      const newNotifRef = db.collection("notifications").doc();

      await newNotifRef.set({
            userId: after.createdBy.uid,
            message: `Your ePRF for ${after.patientName} was returned for correction.`,
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            link: `/patients/${after.patientId}`,
      });
    }
    return null;
  });

export const getSeniorClinicians = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "The function must be called while authenticated."
      );
    }
    
    const seniorRoles = ['FREC5/EMT/AAP', 'Paramedic', 'Nurse', 'Doctor', 'Manager', 'Admin'];
    
    // Also check if the person requesting the list is a senior clinician
    const requesterDoc = await admin.firestore().collection("users").doc(context.auth.uid).get();
    const requesterData = requesterDoc.data();
    if (!requesterData || !seniorRoles.includes(requesterData.role)) {
        throw new functions.https.HttpsError(
            "permission-denied",
            "User must be a senior clinician to access this list."
        );
    }

    const db = admin.firestore();
    const usersSnapshot = await db.collection("users").where("role", "in", seniorRoles).get();
    
    const clinicians = usersSnapshot.docs.map(doc => {
        const user = doc.data();
        return {
            uid: doc.id,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
        };
    });

    return { clinicians };
  }
);

export const getStaffListForKudos = functions.https.onCall(
    async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "The function must be called while authenticated."
            );
        }

        const db = admin.firestore();
        const usersSnapshot = await db.collection("users").where("role", "!=", "Pending").get();

        const staffList = usersSnapshot.docs.map((doc) => {
            const user = doc.data();
            return {
                uid: doc.id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                role: user.role,
            };
        });

        return { staff: staffList };
    }
);

// Bidding Cloud Functions
export const bidOnShift = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be authenticated to bid.");
    }
    const { shiftId, slotId } = data;
    if (!shiftId || !slotId) {
        throw new functions.https.HttpsError("invalid-argument", "shiftId and slotId are required.");
    }

    const userDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
    const userData = userDoc.data();
    if (!userData) {
        throw new functions.https.HttpsError("not-found", "User profile not found.");
    }

    const user = {
        uid: context.auth.uid,
        name: `${userData.firstName} ${userData.lastName}`.trim(),
    };
    
    const shiftRef = admin.firestore().collection('shifts').doc(shiftId);
    
    return admin.firestore().runTransaction(async (transaction) => {
        const shiftDoc = await transaction.get(shiftRef);
        if (!shiftDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Shift not found.');
        }
        
        const shiftData = shiftDoc.data() as any; // Cast to Shift type if available
        const slotIndex = shiftData.slots.findIndex((s: any) => s.id === slotId);

        if (slotIndex === -1) {
            throw new functions.https.HttpsError('not-found', 'Slot not found.');
        }
        if (shiftData.slots[slotIndex].assignedStaff) {
             throw new functions.https.HttpsError('failed-precondition', 'Slot is already assigned.');
        }
        const hasBid = shiftData.slots[slotIndex].bids.some((b: any) => b.uid === user.uid);
        if (hasBid) {
            throw new functions.https.HttpsError('already-exists', 'You have already bid on this slot.');
        }

        shiftData.slots[slotIndex].bids.push({ ...user, timestamp: admin.firestore.FieldValue.serverTimestamp() });
        transaction.update(shiftRef, { slots: shiftData.slots });
        return { success: true };
    });
});

export const cancelBidOnShift = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
    }
    const { shiftId, slotId } = data;
    if (!shiftId || !slotId) {
        throw new functions.https.HttpsError("invalid-argument", "shiftId and slotId are required.");
    }

    const shiftRef = admin.firestore().collection('shifts').doc(shiftId);

    return admin.firestore().runTransaction(async (transaction) => {
        const shiftDoc = await transaction.get(shiftRef);
        if (!shiftDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Shift not found.');
        }

        const shiftData = shiftDoc.data() as any;
        const slotIndex = shiftData.slots.findIndex((s: any) => s.id === slotId);
        if (slotIndex === -1) {
            throw new functions.https.HttpsError('not-found', 'Slot not found.');
        }

        const initialBidCount = shiftData.slots[slotIndex].bids.length;
        shiftData.slots[slotIndex].bids = shiftData.slots[slotIndex].bids.filter((b: any) => b.uid !== context.auth!.uid);

        if (initialBidCount === shiftData.slots[slotIndex].bids.length) {
            // No bid was removed, which is not an error, just an FYI.
            return { success: true, message: "No bid found to withdraw." };
        }

        transaction.update(shiftRef, { slots: shiftData.slots });
        return { success: true };
    });
});
