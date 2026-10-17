import { render, screen } from '@testing-library/react';
import App from './App';

test('shows the DinkSync login screen for unauthenticated visitors', async () => {
  localStorage.clear();
  window.history.replaceState({}, '', '/');
  render(<App />);
  expect(await screen.findByRole('heading', { name: /login/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
});
