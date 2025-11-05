import React, { useState, FormEvent } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    sendEmailVerification, 
    updateProfile,
    sendPasswordResetEmail
} from 'firebase/auth';
import { auth } from '../services/firebase';
import { createUserProfile } from '../services/userService';
import { SpinnerIcon } from '../components/icons';
import type { User } from '../types';

declare const grecaptcha: any;

const validatePassword = (password: string): string[] => {
    const errors: string[] = [];
    if (password.length < 6) {
        errors.push("Must be at least 6 characters long.");
    }
    if (!/[a-z]/.test(password)) {
        errors.push("Must contain a lowercase letter.");
    }
    if (!/[A-Z]/.test(password)) {
        errors.push("Must contain an uppercase letter.");
    }
    if (!/[0-9]/.test(password)) {
        errors.push("Must contain a number.");
    }
    if (!/[^a-zA-Z0-9]/.test(password)) {
        errors.push("Must contain a special character.");
    }
    return errors;
};


const Login: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = ReactRouterDOM.useNavigate();

  const handlePasswordReset = async () => {
    if (!email) {
        setError('Please enter your email address to reset your password.');
        return;
    }
    setLoading(true);
    setError('');
    setMessage('');
    try {
        await sendPasswordResetEmail(auth, email);
        setMessage('Password reset email sent. Please check your inbox.');
    } catch (err: any) {
        if (err.code === 'auth/user-not-found') {
            setError('No account found with this email address.');
        } else {
            setError('Failed to send password reset email. Please try again.');
        }
        console.error(err);
    } finally {
        setLoading(false);
    }
  };


  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    if (!email || !password) {
      setError('Please enter both email and password.');
      setLoading(false);
      return;
    }

    if (isLogin) {
        try {
            await signInWithEmailAndPassword(auth, email, password);
            navigate('/');
        } catch (err: any) {
            if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                setError('Invalid email or password.');
            } else {
                setError('An unexpected error occurred. Please try again.');
                console.error(err);
            }
        } finally {
            setLoading(false);
        }
    } else {
        // Register
        if (!firstName || !lastName) {
            setError('Please provide your first and last name.');
            setLoading(false);
            return;
        }

        const passwordErrors = validatePassword(password);
        if (passwordErrors.length > 0) {
            setError(`Password does not meet requirements:\n• ${passwordErrors.join('\n• ')}`);
            setLoading(false);
            return;
        }

        // CRITICAL SECURITY FIX: The insecure client-side registration logic has been removed.
        // A secure, backend-driven approach is mandatory for production environments.
        //
        // RATIONALE: Performing user creation on the client-side with reCAPTCHA is insecure because
        // the reCAPTCHA token verification can be easily bypassed by an attacker. A malicious user
        // could intercept the request, remove the reCAPTCHA part, and directly call the Firebase
        // client-side API to create users, leading to automated abuse (spam account creation).
        //
        // REQUIRED IMPLEMENTATION:
        // 1. Create a Firebase Cloud Function (e.g., 'registerUser').
        // 2. The client (this form) should get a reCAPTCHA token and send it along with the user's
        //    email, password, and other details to this Cloud Function.
        // 3. The Cloud Function MUST verify the reCAPTCHA token with Google's servers using your secret key.
        // 4. If the token is valid, the Cloud Function (running in a trusted server environment) then uses the
        //    Firebase Admin SDK to create the Auth user and the Firestore user profile.
        // 5. This ensures the reCAPTCHA challenge cannot be bypassed.
        setError('Registration is temporarily disabled. Please contact an administrator.');
        setLoading(false);
    }
  };

  const inputClasses = "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-ams-light-blue focus:border-ams-light-blue sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:placeholder-gray-400";
  const labelClasses = "block text-sm font-medium text-gray-700 dark:text-gray-300";

  return (
    <div className="flex items-center justify-center min-h-screen bg-ams-gray dark:bg-gray-900">
      <div className="w-full max-w-md p-8 space-y-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <div className="flex justify-center">
            <img src="https://145955222.fs1.hubspotusercontent-eu1.net/hubfs/145955222/AMS/Logo%20FINAL%20(2).png" alt="AMS Logo" className="h-16" />
        </div>
        <h2 className="text-2xl font-bold text-center text-ams-blue dark:text-white">{isLogin ? 'Staff Hub Login' : 'Create Account'}</h2>
        
        {error && <p className="text-red-500 text-sm text-center font-semibold whitespace-pre-line">{error}</p>}
        {message && <p className="text-green-600 text-sm text-center font-semibold">{message}</p>}
        
        <form className="space-y-4" onSubmit={handleSubmit}>
          {!isLogin && (
             <>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="firstName" className={labelClasses}>First Name</label>
                        <input id="firstName" name="firstName" type="text" required value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClasses} />
                    </div>
                     <div>
                        <label htmlFor="lastName" className={labelClasses}>Last Name</label>
                        <input id="lastName" name="lastName" type="text" required value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClasses} />
                    </div>
                </div>
                 <div>
                    <label htmlFor="registrationNumber" className={labelClasses}>Professional Registration (e.g. HCPC, optional)</label>
                    <input id="registrationNumber" name="registrationNumber" type="text" value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} className={inputClasses} />
                </div>
            </>
          )}
          <div>
            <label htmlFor="email" className={labelClasses}>Email address</label>
            <input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClasses} />
          </div>
          <div>
            <div className="flex justify-between items-center">
                <label htmlFor="password"  className={labelClasses}>Password</label>
                {isLogin && (
                    <button type="button" onClick={handlePasswordReset} className="text-xs text-ams-light-blue hover:underline focus:outline-none">
                        Forgot password?
                    </button>
                )}
            </div>
            <input id="password" name="password" type="password" autoComplete={isLogin ? "current-password" : "new-password"} required value={password} onChange={(e) => setPassword(e.target.value)} className={inputClasses} />
             {!isLogin && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Must be at least 6 characters and include an uppercase letter, a lowercase letter, a number, and a special character.
                </p>
            )}
          </div>
          <div>
            <button type="submit" disabled={loading} className="w-full px-4 py-2 font-semibold text-white bg-ams-blue rounded-md hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ams-blue disabled:bg-gray-400 flex items-center justify-center">
              {loading && <SpinnerIcon className="w-5 h-5 mr-2" />}
              {isLogin ? 'Sign In' : 'Register'}
            </button>
          </div>
        </form>
        <p className="text-sm text-center text-gray-600 dark:text-gray-400">
          {isLogin ? "Don't have an account?" : "Already have an account?"}
          <button onClick={() => { setIsLogin(!isLogin); setError(''); setMessage(''); }} className="ml-1 font-medium text-ams-light-blue hover:underline">
            {isLogin ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
};

export default Login;
