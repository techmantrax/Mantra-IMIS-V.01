import { useEffect } from 'react';

function App() {
  useEffect(() => {
    // Redirect to the Mantra IMIS HTML app
    window.location.href = '/mantra.html';
  }, []);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      fontFamily: 'system-ui, sans-serif',
      background: '#f5f5f5'
    }}>
      <div style={{ textAlign: 'center' }}>
        <h2>Loading Mantra IMIS...</h2>
        <p>Redirecting to the application...</p>
      </div>
    </div>
  );
}

export default App;
