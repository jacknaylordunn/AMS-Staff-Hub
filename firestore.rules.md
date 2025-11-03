# Aegis Hub Firestore Security Rules

This document outlines the recommended security rules for the Firestore database to ensure data integrity and security based on user roles. These rules should be deployed to your Firebase project.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
  
    // Helper function to check if user is a Manager or Admin
    function isManager() {
      return getUserRole() in ['Manager', 'Admin'];
    }
    
    // Helper function to get the user's role from the users collection
    function getUserRole() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
    }

    // Users Collection
    // - Users can read their own profile.
    // - Managers/Admins can read any user profile.
    // - Users can update their own profile, but cannot change their own role.
    // - Admins can update any user profile, including roles.
    match /users/{userId} {
      allow read: if request.auth.uid == userId || isManager();
      allow create: if request.auth.uid == userId;
      allow update: if request.auth.uid == userId && !("role" in request.resource.data)
                      || getUserRole() == 'Admin';
    }

    // Patients Collection
    // - Authenticated users can create patients.
    // - Authenticated users (staff) can read all patient data.
    // - Only managers should be able to update/delete patient records (TBD).
    match /patients/{patientId} {
      allow read, create: if request.auth != null;
      // allow update, delete: if isManager(); // Future enhancement
    }

    // ePRFs Collection
    // - Staff can create ePRFs.
    // - Staff can read/update their own draft ePRFs.
    // - Once status is not 'Draft', the creator cannot edit it.
    // - Managers can read all ePRFs.
    // - Managers can update an ePRF to set the review status.
    match /eprfs/{eprfId} {
        allow read: if request.auth != null;
        allow create: if request.auth.uid == request.resource.data.createdBy.uid;
        allow update: if resource.data.createdBy.uid == request.auth.uid && resource.data.status == 'Draft'
                        || (isManager() && "status" in request.resource.data);
        allow delete: if resource.data.createdBy.uid == request.auth.uid && resource.data.status == 'Draft';
    }

    // Events, Documents, Shifts Collections
    // - All authenticated users can read.
    // - Only Managers/Admins can create, update, or delete.
    match /events/{eventId} {
      allow read: if request.auth != null;
      allow write: if isManager();
    }
    
    match /documents/{docId} {
        allow read: if request.auth != null;
        allow write: if isManager(); // Should be create/update/delete
    }

    match /shifts/{shiftId} {
        allow read: if request.auth != null;
        allow write: if isManager();
    }
  }
}
```

### Key Principles of These Rules:

1.  **Default Deny:** Access is denied unless explicitly allowed by a rule.
2.  **Authentication Required:** Most data is inaccessible to unauthenticated users.
3.  **Principle of Least Privilege:** Users only have the minimum permissions necessary for their role. A standard staff member cannot modify rotas or approve reports.
4.  **Data Integrity:** Rules prevent users from performing invalid actions, such as changing their own role or editing a finalized ePRF.
5.  **Role-Based Access:** The `isManager()` and `getUserRole()` helper functions are central to enabling powerful, role-based permissions throughout the database.