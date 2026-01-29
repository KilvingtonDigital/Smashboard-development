import React, { useState } from 'react';
import Login from './Login';
import Register from './Register';
import ForgotPassword from './ForgotPassword';

const AuthPage = () => {
  const [view, setView] = useState('login'); // login, register, forgot

  return (
    <>
      {view === 'login' && (
        <Login
          onSwitchToRegister={() => setView('register')}
          onForgotPassword={() => setView('forgot')}
        />
      )}
      {view === 'register' && (
        <Register onSwitchToLogin={() => setView('login')} />
      )}
      {view === 'forgot' && (
        <ForgotPassword onSwitchToLogin={() => setView('login')} />
      )}
    </>
  );
};

export default AuthPage;
