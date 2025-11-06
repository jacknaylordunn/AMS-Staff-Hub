# Aegis Hub Firebase Storage Security Rules
# These rules should be deployed to your Firebase project's Storage section.

rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {

    // Helper function to get a user's data from Firestore
    function getUserData(userId) {
      return get(/databases/$(database)/documents/users/$(userId)).data;
    }

    // Helper function to check if a user is a Manager or Admin
    function isManagerOrAdmin(uid) {
      let userData = getUserData(uid);
      return userData != null && userData.role in ['Manager', 'Admin'];
    }
    
    // Public company documents. Any authenticated user can read. Only managers can write.
    match /documents/{fileName} {
      allow read: if request.auth != null;
      allow write: if isManagerOrAdmin(request.auth.uid);
    }
    
    // User-specific compliance documents. Only the user and managers can access.
    match /compliance_documents/{userId}/{fileName} {
      allow read, write: if request.auth.uid == userId || isManagerOrAdmin(request.auth.uid);
    }
    
    // User-specific CPD attachments. User can write, user and managers can read.
    match /cpd_attachments/{userId}/{fileName} {
      allow read: if request.auth.uid == userId || isManagerOrAdmin(request.auth.uid);
      allow write: if request.auth.uid == userId;
    }
    
    // ePRF signatures and attachments.
    // The rules need to read the corresponding ePRF document from Firestore to verify ownership.
    function getEprfData(eprfId) {
        return get(/databases/$(database)/documents/eprfs/$(eprfId)).data;
    }
    match /signatures/{eprfId}/{fileName} {
        // Only the creator of the ePRF or a manager can upload/read signatures for it.
        allow read, write: if getEprfData(eprfId).createdBy.uid == request.auth.uid || isManagerOrAdmin(request.auth.uid);
    }

    match /attachments/{eprfId}/{fileName} {
        // Only the creator of the ePRF or a manager can upload/read attachments for it.
        allow read, write: if getEprfData(eprfId).createdBy.uid == request.auth.uid || isManagerOrAdmin(request.auth.uid);
    }
    
    // Default deny all other paths
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}