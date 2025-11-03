
import React, { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
// Fix: Remove v9 imports, use methods on `auth` and `user` objects for v8
import { auth } from '../services/firebase';
import { createUserProfile } from '../services/firestoreService';
import { SpinnerIcon } from '../components/icons';

const Login: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState('First Aider');
  const [registrationNumber, setRegistrationNumber] = useState('');

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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

    try {
      if (isLogin) {
        // Fix: Use v8 `auth.signInWithEmailAndPassword` method
        await auth.signInWithEmailAndPassword(email, password);
        navigate('/');
      } else {
        // Register
        if (!displayName || !role) {
            setError('Please provide your full name and role.');
            setLoading(false);
            return;
        }
        // Fix: Use v8 `auth.createUserWithEmailAndPassword` method
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        
        if (!userCredential.user) {
          throw new Error("User could not be created.");
        }

        // Fix: Use v8 `user.updateProfile` method
        await userCredential.user.updateProfile({ displayName });
        await createUserProfile(userCredential.user.uid, {
            email: userCredential.user.email!,
            displayName,
            role: role as any,
            registrationNumber
        });

        // Fix: Use v8 `user.sendEmailVerification` method
        await userCredential.user.sendEmailVerification();
        setMessage('Account created. Please check your email to verify your account before logging in.');
        
        // UX Improvement: Clear registration-specific fields after success.
        // Keep email pre-filled for the login form.
        setDisplayName('');
        setPassword('');
        setRegistrationNumber('');

        setIsLogin(true); // Switch to login view
      }
    } catch (err: any) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Invalid email or password.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('An account with this email already exists.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      }
      else {
        setError('An unexpected error occurred. Please try again.');
        console.error(err);
      }
    } finally {
        setLoading(false);
    }
  };

  const inputClasses = "w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:ring-ams-light-blue focus:border-ams-light-blue dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200";
  const labelClasses = "text-sm font-medium text-gray-700 dark:text-gray-300";

  return (
    <div className="flex items-center justify-center min-h-screen bg-ams-gray dark:bg-gray-900">
      <div className="w-full max-w-md p-8 space-y-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <div className="flex justify-center">
            <img src="https://145955222.fs1.hubspotusercontent-eu1.net/hubfs/145955222/AMS/Logo%20FINAL%20(2).png" alt="AMS Logo" className="h-16" />
        </div>
        <h2 className="text-2xl font-bold text-center text-ams-blue dark:text-white">{isLogin ? 'Staff Hub Login' : 'Create Account'}</h2>
        
        {error && <p className="text-red-500 text-sm text-center font-semibold">{error}</p>}
        {message && <p className="text-green-600 text-sm text-center font-semibold">{message}</p>}
        
        <form className="space-y-4" onSubmit={handleSubmit}>
          {!isLogin && (
             <>
                <div>
                    <label htmlFor="displayName" className={labelClasses}>Full Name</label>
                    <input id="displayName" name="displayName" type="text" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputClasses} />
                </div>
                 <div>
                    <label htmlFor="role" className={labelClasses}>Clinical Role</label>
                    <select id="role" name="role" required value={role} onChange={(e) => setRole(e.target.value)} className={`${inputClasses} bg-white dark:bg-gray-700`}>
                        <option>First Aider</option>
                        <option>EMT</option>
                        <option>Nurse</option>
                        <option>Paramedic</option>
                        <option>Welfare</option>
                        <option>Admin</option>
                    </select>
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
            <label htmlFor="password"  className={labelClasses}>Password</label>
            <input id="password" name="password" type="password" autoComplete={isLogin ? "current-password" : "new-password"} required value={password} onChange={(e) => setPassword(e.target.value)} className={inputClasses} />
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
