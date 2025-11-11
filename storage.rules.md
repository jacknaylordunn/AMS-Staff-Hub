rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {

    function getUserData(userId) {
      return firestore.get(/databases/(default)/documents/users/$(userId)).data;
    }

    function isManagerOrAdmin(uid) {
      let userData = getUserData(uid);
      return userData != null && userData.role in ['Manager', 'Admin'];
    }

    function getEprfData(eprfId) {
        return firestore.get(/databases/(default)/documents/eprfs/$(eprfId)).data;
    }

    match /documents/{fileName} {
      allow read: if request.auth != null;
      allow write: if isManagerOrAdmin(request.auth.uid);
    }
    
    match /compliance_documents/{userId}/{fileName} {
      allow read, write: if request.auth.uid == userId || isManagerOrAdmin(request.auth.uid);
    }
    
    match /cpd_attachments/{userId}/{fileName} {
      allow read: if request.auth.uid == userId || isManagerOrAdmin(request.auth.uid);
      allow write: if request.auth.uid == userId;
    }
    
    match /signatures/{eprfId}/{fileName} {
        allow read, write: if getEprfData(eprfId).createdBy.uid == request.auth.uid || isManagerOrAdmin(request.auth.uid);
    }

    match /attachments/{eprfId}/{fileName} {
        allow read, write: if getEprfData(eprfId).createdBy.uid == request.auth.uid || isManagerOrAdmin(request.auth.uid);
    }
    
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}