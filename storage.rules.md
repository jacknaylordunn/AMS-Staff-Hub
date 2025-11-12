rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {

    function isUser(userId) {
      return request.auth != null && request.auth.uid == userId;
    }
    function isManager() {
        return request.auth != null && firestore.get(/databases/(default)/documents/users/$(request.auth.uid)).data.role in ['Manager', 'Admin'];
    }

    function isValidImage() {
        return request.resource.size < 5 * 1024 * 1024 // < 5MB
            && request.resource.contentType.matches('image/.*');
    }
    function isValidDocument() {
        return request.resource.size < 10 * 1024 * 1024 // < 10MB
            && (request.resource.contentType.matches('application/pdf') ||
                request.resource.contentType.matches('application/msword') ||
                request.resource.contentType.matches('application/vnd.openxmlformats-officedocument.wordprocessingml.document'));
    }

    match /documents/{fileName} {
      allow read: if request.auth != null;
      allow write: if isManager() && isValidDocument();
    }
    
    match /compliance_documents/{userId}/{fileName} {
      allow read: if isUser(userId) || isManager();
      allow write: if (isUser(userId) || isManager()) && (isValidDocument() || isValidImage());
    }
    
    match /cpd_attachments/{userId}/{fileName} {
      allow read: if isUser(userId) || isManager();
      allow write: if isUser(userId) && (isValidDocument() || isValidImage());
    }
    
    match /signatures/{eprfId}/{fileName} {
        allow read: if request.auth != null; // Simplified, assuming access is controlled via URL
        allow write: if request.auth != null && isValidImage();
    }

    match /attachments/{eprfId}/{fileName} {
        allow read: if request.auth != null;
        allow write: if request.auth != null && (isValidImage() || isValidDocument() || request.resource.contentType.matches('video/.*'));
    }
    
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}