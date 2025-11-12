// Forcing deployment v5
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated, onDocumentDeleted, onDocumentWritten } from "firebase-functions/v2/firestore";
import { setGlobalOptions } from "firebase-functions/v2";
import * as admin from "firebase-admin";
import { GoogleGenAI } from "@google/genai";

admin.initializeApp();

// Set the region for all functions
setGlobalOptions({ region: "us-central1" });

// Initialize the Gemini client. It will automatically use the API_KEY secret.
// Ensure the secret is set by running: firebase functions:secrets:set API_KEY
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error(
    "Gemini API key not found. Set the secret by running 'firebase functions:secrets:set API_KEY'"
  );
}

const ai = new GoogleGenAI({ apiKey: API_KEY! });

// Helper function to determine shift status based on filled slots
const getShiftStatus = (slotsArr: any[]): string => {
    const totalSlots = slotsArr.length;
    const filledSlots = slotsArr.filter((s: any) => s && s.assignedStaff).length;
    if (filledSlots === 0) return 'Open';
    if (filledSlots < totalSlots) return 'Partially Assigned';
    return 'Fully Assigned';
};


// Updated to onCall v2 syntax and granted access to the API_KEY secret.
export const askClinicalAssistant = onCall(
  { secrets: ["API_KEY"] },
  async (request) => {
    // Check if the user is authenticated.
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "The function must be called while authenticated."
      );
    }

    const query = request.data.query;
    if (!query || typeof query !== "string") {
      throw new HttpsError(
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
                responseMimeType: request.data.query.includes("JSON object") ? "application/json" : "text/plain",
            }
        });

      return { response: result.text };
    } catch (error) {
      console.error("Gemini API call failed:", error);
      throw new HttpsError(
        "internal",
        "Failed to get a response from the AI assistant."
      );
    }
  }
);

// Updated to onCall v2 syntax.
export const sendAnnouncement = onCall(
  async (request) => {
    // Check auth
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "The function must be called while authenticated."
      );
    }
    
    // Check for manager/admin role
    const userDoc = await admin.firestore().collection("users").doc(request.auth.uid).get();
    const userData = userDoc.data();
    if (!userData || !['Manager', 'Admin'].includes(userData.role)) {
        throw new HttpsError(
            "permission-denied",
            "User must be a Manager or Admin to send announcements."
        );
    }

    const message = request.data.message;
    const link = request.data.link;
    const target = request.data.target as {
        type: "all" | "roles" | "event";
        roles?: string[];
        eventName?: string;
    };

    if (!message || typeof message !== "string") {
        throw new HttpsError(
            "invalid-argument",
            "The function must be called with a 'message' string argument."
        );
    }
    if (!target || !target.type) {
        throw new HttpsError("invalid-argument", "A valid 'target' object must be provided.");
    }
    
    const db = admin.firestore();
    const uniqueUserIds = new Set<string>();

    if (target.type === "roles") {
        if (!target.roles || !Array.isArray(target.roles) || target.roles.length === 0) {
            throw new HttpsError("invalid-argument", "Target type 'roles' requires a non-empty 'roles' array.");
        }
        const usersSnapshot = await db.collection("users").where("role", "in", target.roles).get();
        usersSnapshot.forEach((doc) => uniqueUserIds.add(doc.id));
    } else if (target.type === "event") {
        if (!target.eventName || typeof target.eventName !== "string") {
            throw new HttpsError("invalid-argument", "Target type 'event' requires an 'eventName' string.");
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

    const senderName = (userData.firstName && userData.lastName) ? `${userData.firstName} ${userData.lastName}`.trim() : request.auth.token.name;
    const sender = {
        uid: request.auth.uid,
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
        throw new HttpsError(
            "internal",
            "Failed to send announcement."
        );
    }
  }
);


export const onUserUpdate = onDocumentWritten("users/{userId}", async (event) => {
    if (!event.data) return null;

    const before = event.data.before.data();
    const after = event.data.after.data();
    // On delete or create, do nothing
    if (!before || !after) return null;

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
            userId: event.params.userId,
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

export const onKudoCreate = onDocumentCreated("kudos/{kudoId}", async (event) => {
        const snap = event.data;
        if (!snap) return;
        const kudo = snap.data();

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

export const onEprfWrite = onDocumentWritten("eprfs/{eprfId}", async (event) => {
    const eprfId = event.params.eprfId;
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();
    const db = admin.firestore();
    const promises = [];

    // --- Data Integrity: Update patient's authorized clinicians ---
    if (afterData && afterData.patientId) {
        const crewUids = (afterData.crewMembers || []).map((c: any) => c.uid).filter(Boolean);
        if (crewUids.length > 0) {
            const patientRef = db.collection("patients").doc(afterData.patientId);
            promises.push(patientRef.update({
                authorizedClinicianUids: admin.firestore.FieldValue.arrayUnion(...crewUids)
            }));
        }
    }
    
    // --- Notification Logic ---
    if (beforeData && afterData) { // This is an update
        // 1. Check if ePRF was returned to draft
        if (beforeData.status !== 'Draft' && afterData.status === 'Draft' && afterData.reviewNotes) {
            const newNotifRef = db.collection("notifications").doc();
            promises.push(newNotifRef.set({
                    userId: afterData.createdBy.uid,
                    message: `Your ePRF for ${afterData.patientName} was returned for correction.`,
                    read: false,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    link: `/patients/${afterData.patientId}?eprfId=${eprfId}`,
            }));
        }
        
        // 2. Check if ePRF was submitted for review
        if (beforeData.status === 'Draft' && afterData.status === 'Pending Review') {
            const usersSnapshot = await db.collection("users").where("role", "in", ["Manager", "Admin"]).get();
            if (!usersSnapshot.empty) {
                const batch = db.batch();
                const notificationMessage = `${afterData.createdBy.name} submitted an ePRF for review (${afterData.patientName}).`;
                
                usersSnapshot.forEach(doc => {
                    const newNotifRef = db.collection("notifications").doc();
                    batch.set(newNotifRef, {
                        userId: doc.id,
                        message: notificationMessage,
                        read: false,
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        link: `/patients/${afterData.patientId}?eprfId=${eprfId}`,
                    });
                });
                promises.push(batch.commit());
            }
        }
    }
    
    if (promises.length > 0) {
        await Promise.all(promises);
    }
    return null;
});


// Updated to onCall v2 syntax.
export const getSeniorClinicians = onCall(
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "The function must be called while authenticated."
      );
    }
    
    const seniorRoles = ['FREC5/EMT/AAP', 'Paramedic', 'Nurse', 'Doctor', 'Manager', 'Admin'];
    
    // Also check if the person requesting the list is a senior clinician
    const requesterDoc = await admin.firestore().collection("users").doc(request.auth.uid).get();
    const requesterData = requesterDoc.data();
    if (!requesterData || !seniorRoles.includes(requesterData.role)) {
        throw new HttpsError(
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

// Updated to onCall v2 syntax.
export const getStaffListForKudos = onCall(
    async (request) => {
        if (!request.auth) {
            throw new HttpsError(
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

// Updated to onCall v2 syntax.
export const bidOnShift = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }
  const {uid} = request.auth;
  const {shiftId, slotId} = request.data;
  if (typeof shiftId !== "string" || typeof slotId !== "string") {
    throw new HttpsError(
      "invalid-argument",
      "'shiftId' and 'slotId' must be strings."
    );
  }

  const userDoc = await admin.firestore().collection("users").doc(uid).get();
  if (!userDoc.exists) {
    throw new HttpsError("not-found", "User profile not found.");
  }
  const userData = userDoc.data()!;
  const userName = `${userData.firstName || ""} ${
    userData.lastName || ""
  }`.trim();

  const shiftRef = admin.firestore().collection("shifts").doc(shiftId);

  try {
    await admin.firestore().runTransaction(async (transaction) => {
      const shiftDoc = await transaction.get(shiftRef);
      if (!shiftDoc.exists) {
        throw new HttpsError("not-found", "Shift does not exist.");
      }

      const shiftData = shiftDoc.data()!;
      const slots = Array.isArray(shiftData.slots) ? shiftData.slots : [];
      const slotIndex = slots.findIndex((s: any) => s && s.id === slotId);

      if (slotIndex === -1) {
        throw new HttpsError("not-found", "The selected slot was not found.");
      }

      const targetSlot = slots[slotIndex];

      if (targetSlot.assignedStaff) {
        throw new HttpsError(
          "failed-precondition",
          "This slot is already assigned."
        );
      }

      const bids = Array.isArray(targetSlot.bids) ? targetSlot.bids : [];
      if (bids.some((b: any) => b && b.uid === uid)) {
        // Silently succeed if already bid, no need to throw.
        return;
      }

      const newSlots = slots.map((s, index) => {
        if (index === slotIndex) {
          const currentBids = Array.isArray(s.bids) ? s.bids : [];
          return {
            ...s,
            bids: [
              ...currentBids,
              {
                uid: uid,
                name: userName,
                timestamp: admin.firestore.Timestamp.now(),
              },
            ],
          };
        }
        return s;
      });

      transaction.update(shiftRef, {slots: newSlots});
    });
    return {success: true};
  } catch (error: any) {
    console.error("Transaction failed: bidOnShift", error);
    if (error.code) {
      // It's already an HttpsError
      throw error;
    }
    throw new HttpsError(
      "internal",
      "Could not place bid due to a server error."
    );
  }
});


// Updated to onCall v2 syntax.
export const cancelBidOnShift = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Authentication is required.");
    }
    const { uid } = request.auth;
    const { shiftId, slotId } = request.data;
    if (typeof shiftId !== "string" || typeof slotId !== "string") {
        throw new HttpsError("invalid-argument", "'shiftId' and 'slotId' must be strings.");
    }

    const shiftRef = admin.firestore().collection("shifts").doc(shiftId);

    try {
        await admin.firestore().runTransaction(async (transaction) => {
            const shiftDoc = await transaction.get(shiftRef);
            if (!shiftDoc.exists) {
                throw new HttpsError("not-found", "Shift does not exist.");
            }

            const shiftData = shiftDoc.data()!;
            const slots = Array.isArray(shiftData.slots) ? shiftData.slots : [];
            const slotIndex = slots.findIndex((s: any) => s && s.id === slotId);

            if (slotIndex === -1) {
                // Silently succeed if the slot doesn't exist anymore.
                return;
            }
            
            const newSlots = slots.map((s, index) => {
                if (index === slotIndex) {
                    const bids = Array.isArray(s.bids) ? s.bids : [];
                    return {
                        ...s,
                        bids: bids.filter((b: any) => b && b.uid !== uid),
                    };
                }
                return s;
            });
            
            transaction.update(shiftRef, { slots: newSlots });
        });

        return { success: true };
    } catch (error: any) {
        console.error("Transaction failed: cancelBidOnShift", error);
         if (error.code) { // It's already an HttpsError
            throw error;
        }
        throw new HttpsError("internal", "Could not withdraw bid due to a server error.");
    }
});

export const assignStaffToShiftSlot = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Authentication is required.");
    }
    const { uid } = request.auth;
    const { shiftId, slotId, staff } = request.data; // staff is { uid, name } or null

    if (typeof shiftId !== "string" || typeof slotId !== "string") {
        throw new HttpsError("invalid-argument", "'shiftId' and 'slotId' must be strings.");
    }

    // Check for manager/admin role
    const userDoc = await admin.firestore().collection("users").doc(uid).get();
    const userData = userDoc.data();
    if (!userData || !['Manager', 'Admin'].includes(userData.role)) {
        throw new HttpsError("permission-denied", "User must be a Manager or Admin to assign staff.");
    }

    const shiftRef = admin.firestore().collection("shifts").doc(shiftId);

    try {
        await admin.firestore().runTransaction(async (transaction) => {
            const shiftDoc = await transaction.get(shiftRef);
            if (!shiftDoc.exists) {
                throw new HttpsError("not-found", "Shift does not exist.");
            }

            const shiftData = shiftDoc.data()!;
            const slots = Array.isArray(shiftData.slots) ? shiftData.slots : [];
            const slotIndex = slots.findIndex((s: any) => s && s.id === slotId);

            if (slotIndex === -1) {
                throw new HttpsError("not-found", "The specified slot does not exist.");
            }

            // Assign staff (or null to unassign) and clear bids for the slot
            slots[slotIndex].assignedStaff = staff;
            if (staff) {
                slots[slotIndex].bids = [];
            }
            
            transaction.update(shiftRef, { 
                slots: slots,
            });
        });
        
        return { success: true };
    } catch (error: any) {
        console.error("Transaction failed: assignStaffToShiftSlot", error);
        if (error.code) { // It's already an HttpsError
            throw error;
        }
        throw new HttpsError("internal", "Could not assign staff due to a server error.");
    }
});


// NEW: Centralized shift logic trigger. Replaces onShiftCreate and onShiftUpdate.
export const onShiftWrite = onDocumentWritten("shifts/{shiftId}", async (event) => {
    const shiftId = event.params.shiftId;
    const afterData = event.data?.after.data();

    // On delete, do nothing
    if (!afterData) {
        console.log(`Shift ${shiftId} deleted. No further action.`);
        return;
    }

    // On create/update, recalculate derived data and update the document
    const slots = (afterData.slots as any[]) || [];
    const allAssignedStaffUids = [...new Set(slots.map(s => s.assignedStaff?.uid).filter(Boolean))];
    const status = getShiftStatus(slots);
    
    // Check if an update is needed to prevent infinite trigger loops
    if (
        status !== afterData.status ||
        JSON.stringify(allAssignedStaffUids.sort()) !== JSON.stringify((afterData.allAssignedStaffUids || []).sort())
    ) {
        await event.data?.after.ref.update({
            status,
            allAssignedStaffUids,
        });
        // Return here because this update will re-trigger the function, and we'll handle notifications then.
        return;
    }

    // Notification logic
    const beforeData = event.data?.before.data();
    if (beforeData) { // This is an update
        const beforeSlots = (beforeData.slots as any[]) || [];
        const afterSlots = (afterData.slots as any[]) || [];

        const beforeStaff = new Set(beforeSlots.map(s => s?.assignedStaff?.uid).filter(Boolean));
        const afterStaff = new Set(afterSlots.map(s => s?.assignedStaff?.uid).filter(Boolean));

        const newAssignments = [...afterStaff].filter(uid => !beforeStaff.has(uid));
        const unAssignments = [...beforeStaff].filter(uid => !afterStaff.has(uid));
        
        if (newAssignments.length > 0 || unAssignments.length > 0) {
            const db = admin.firestore();
            const batch = db.batch();
            
            for (const userId of newAssignments) {
                const newNotifRef = db.collection("notifications").doc();
                batch.set(newNotifRef, {
                    userId: userId,
                    message: `You have been assigned to the shift: ${afterData.eventName} on ${afterData.start.toDate().toLocaleDateString()}`,
                    link: `/brief/${shiftId}`,
                    read: false,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            }
            
            for (const userId of unAssignments) {
                const newNotifRef = db.collection("notifications").doc();
                batch.set(newNotifRef, {
                    userId: userId,
                    message: `You have been un-assigned from the shift: ${afterData.eventName} on ${afterData.start.toDate().toLocaleDateString()}`,
                    link: `/rota`,
                    read: false,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            }
        
            await batch.commit();
        }
    } else { // This is a create
        if (allAssignedStaffUids.length > 0) {
            const db = admin.firestore();
            const batch = db.batch();
            for (const userId of allAssignedStaffUids) {
                const newNotifRef = db.collection("notifications").doc();
                batch.set(newNotifRef, {
                    userId: userId,
                    message: `You have been assigned a new shift: ${afterData.eventName} on ${afterData.start.toDate().toLocaleDateString()}`,
                    link: `/brief/${shiftId}`,
                    read: false,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            }
            await batch.commit();
        }
    }
});


// NEW: Callable function for deleting users
export const deleteUserAndData = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Authentication is required.");
    }

    const adminUid = request.auth.uid;
    const userToDeleteUid = request.data.uid;

    if (!userToDeleteUid || typeof userToDeleteUid !== "string") {
        throw new HttpsError("invalid-argument", "The function must be called with a 'uid' string argument.");
    }
    
    // Verify requester is an Admin
    const adminDoc = await admin.firestore().collection("users").doc(adminUid).get();
    if (!adminDoc.exists || adminDoc.data()?.role !== 'Admin') {
        throw new HttpsError("permission-denied", "Only admins can delete users.");
    }

    try {
        // Delete from Auth
        await admin.auth().deleteUser(userToDeleteUid);
        // Delete from Firestore
        await admin.firestore().collection("users").doc(userToDeleteUid).delete();
        
        // Future enhancement: Add logic here to find and anonymize/delete user-generated content (e.g., ePRFs, CPD logs).
        
        return { success: true, message: `User ${userToDeleteUid} deleted successfully.` };
    } catch (error: any) {
        console.error(`Failed to delete user ${userToDeleteUid}:`, error);
        if (error.code === 'auth/user-not-found') {
            // If user not in auth, maybe they were already deleted. Try deleting from Firestore anyway.
            await admin.firestore().collection("users").doc(userToDeleteUid).delete().catch(() => {});
            return { success: true, message: `User ${userToDeleteUid} not found in Auth, but Firestore record deleted.` };
        }
        throw new HttpsError("internal", "An error occurred while deleting the user.");
    }
});

// NEW: Trigger for aggregating staff analytics
export const onTimeClockWrite = onDocumentWritten("timeClockEntries/{entryId}", async (event) => {
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();

    // On create or delete, do nothing for now. We only care when an entry is completed.
    if (!beforeData || !afterData) {
        return;
    }

    // We only care about entries moving to 'Clocked Out'
    if (beforeData.status === 'Clocked In' && afterData.status === 'Clocked Out' && afterData.durationHours) {
        const userId = afterData.userId;
        const date = afterData.clockInTime.toDate();
        const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; // e.g., "2023-09"

        const analyticsRef = admin.firestore().collection('userAnalytics').doc(userId);
        
        try {
            await admin.firestore().runTransaction(async (transaction) => {
                const doc = await transaction.get(analyticsRef);
                
                const data = doc.exists ? doc.data()! : { totalHours: 0, shiftCount: 0, monthlyHours: {} };

                const newTotalHours = (data.totalHours || 0) + afterData.durationHours;
                const newShiftCount = (data.shiftCount || 0) + 1;
                
                const newMonthlyHours = data.monthlyHours || {};
                newMonthlyHours[monthYear] = (newMonthlyHours[monthYear] || 0) + afterData.durationHours;

                transaction.set(analyticsRef, {
                    totalHours: newTotalHours,
                    shiftCount: newShiftCount,
                    monthlyHours: newMonthlyHours,
                    lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
                    userName: afterData.userName,
                }, { merge: true });
            });
        } catch (e) {
            console.error("Failed to update user analytics:", e);
        }
    }
});

export const onMajorIncidentDelete = onDocumentDeleted("majorIncidents/{incidentId}", async (event) => {
    const incidentId = event.params.incidentId;
    const db = admin.firestore();
    const batchSize = 100;

    const subcollections = ["methaneReports", "checkins"];

    for (const subcollection of subcollections) {
        const collectionRef = db.collection("majorIncidents").doc(incidentId).collection(subcollection);
        let query = collectionRef.orderBy("__name__").limit(batchSize);

        // eslint-disable-next-line no-await-in-loop
        for (let snapshot = await query.get(); snapshot.size > 0; snapshot = await query.get()) {
            const batch = db.batch();
            snapshot.docs.forEach((doc) => {
                batch.delete(doc.ref);
            });
            // eslint-disable-next-line no-await-in-loop
            await batch.commit();
        }
    }
});