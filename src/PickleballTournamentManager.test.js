import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import PickleballTournamentManager from './PickleballTournamentManager';

// Mock dependencies
jest.mock('./contexts/AuthContext', () => ({
    useAuth: () => ({ user: { id: 1, name: 'Test User' } })
}));

// Mock API to return success for everything
const mockApi = {
    players: {
        getAll: jest.fn().mockResolvedValue({ success: true, data: { players: [] } }),
        create: jest.fn().mockImplementation((p) => Promise.resolve({
            success: true,
            data: { player: { ...p, id: Math.random().toString(), present: true } }
        })),
        delete: jest.fn().mockResolvedValue({ success: true })
    }
};

jest.mock('./contexts/APIContext', () => ({
    useAPI: () => mockApi
}));

// Mock window.confirm to always say yes
global.confirm = jest.fn(() => true);
global.alert = jest.fn();

describe('PickleballTournamentManager - Ghost Match Fix', () => {
    beforeEach(() => {
        localStorage.clear();
        jest.clearAllMocks();
    });

    test('Cleaning a court should NOT trigger ghost match assignment', async () => {
        render(<PickleballTournamentManager />);

        // 1. Setup: Add Players (need at least 2 for singles, 4 for doubles)
        // We'll add 4 players for a doubles match to replicate user scenario
        const playersToAdd = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6']; // Extra players to test queue

        // Switch to Roster tab to add players if needed, or just use the Add Player form
        // The component defaults to 'setup' or 'schedule'? 
        // It defaults to 'setup'. We need to be in 'roster' to add players or use bulk add.

        // Debug helper
        const logSection = (msg) => console.log(`\n=== ${msg} ===\n`);

        logSection('Adding Players');
        // Navigate to Roster
        fireEvent.click(screen.getByText(/Roster/i));

        // Add players via bulk text for speed (if available) -> Component has Bulk Add
        const bulkInput = screen.getByPlaceholderText(/Paste list here/i);
        const bulkButton = screen.getByText(/Process Bulk/i);

        fireEvent.change(bulkInput, { target: { value: 'P1, 3.0, m\nP2, 3.0, m\nP3, 3.0, m\nP4, 3.0, m\nP5, 3.0, m\nP6, 3.0, m' } });
        fireEvent.click(bulkButton);

        // Verify players added
        await waitFor(() => {
            expect(screen.getByText('P1')).toBeInTheDocument();
            expect(screen.getByText('P6')).toBeInTheDocument();
        });

        logSection('Starting Tournament');
        // Go to Setup
        fireEvent.click(screen.getByText(/Setup/i));

        // Ensure Round Robin, 4 Courts (default)
        // Click "Start Tournament" (which is actually navigating to Schedule and generating round?)
        // The instructions say "Start New Round" usually.
        // Wait, the component needs to generate the FIRST round.
        // If rounds.length === 0, it shows "Start New Round" or similar?
        // Looking at code: "Start New Round" button appears if courts are ready.
        fireEvent.click(screen.getByText(/Schedule/i));

        // Generate Round 1 (Auto-assigns if RR)
        // Or we manually assign. User said "Select four courts... punch in first game..."
        // Let's manually CLICK "Start New Round" if valuable, OR just assign.
        // The code shows: "Assign matches to courts or use 'Generate Next Round'"

        // Let's manually assign Match 1 to Court 1
        // We need "Start New Round" first to populate rounds? 
        // No, `assignMatchToCourt` creates a match on the fly if manual? 
        // Wait, `assignMatchToCourt` calls `assignDoublesMatchToCourt` which CREATES a match.
        // So we don't need a round exists.

        const court1 = screen.getByText('Court 1').closest('div').parentElement;
        const assignBtn = within(court1).getByText('Assign Match');

        logSection('Assigning Match to Court 1');
        fireEvent.click(assignBtn);

        // Handle the confirm dialog (mocked to true)
        // Validating match creation
        await waitFor(() => {
            expect(within(court1).getByText(/P1\/P2|P3\/P4/i)).toBeInTheDocument(); // Some pairing
            expect(within(court1).getByText(/Playing/i)).toBeInTheDocument();
        });

        logSection('Completing Match on Court 1 (Set Cleaning)');
        // Find "Set Cleaning" button
        const completeBtn = within(court1).getByText('Set Cleaning');
        fireEvent.click(completeBtn);

        // CRITICAL: Verify Court 1 is NOW 'cleaning' matches
        await waitFor(() => {
            expect(within(court1).getByText(/Cleaning/i)).toBeInTheDocument();
        });

        // CRITICAL CHECK 1: Court 1 should NOT be 'Ready' (intermediate state verification is hard, but final state matters)
        expect(within(court1).queryByText(/Ready/i)).not.toBeInTheDocument();

        // CRITICAL CHECK 2: Start a match on Court 2. 
        // If P1/P2/P3/P4 were Ghosted, they would be available for Court 2 assignment!
        // P5 and P6 are free. P1-P4 are cleaning.
        // Assign to Court 2. Matches should ONLY involve P5/P6 (or fail if not enough players).
        // Actually, doubles needs 4 players. P5/P6 is only 2.
        // If P1-P4 are correctly busy (even in cleaning), assignment should FAIL or wait.
        // If P1-P4 are Ghosted (marked ready erroneously), they might be pulled in!

        const court2 = screen.getByText('Court 2').closest('div').parentElement;
        const assignBtn2 = within(court2).getByText('Assign Match');

        // Attempt assignment
        fireEvent.click(assignBtn2);

        // We expect an alert "Need at least 4 available players" because only P5/P6 are free
        // Mock alert and check if it was called
        expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('Need at least 4 available players'));

        // Ensure Court 2 is NOT playing
        expect(within(court2).queryByText(/Playing/i)).not.toBeInTheDocument();

        console.log('Test Passed: Ghost match prevented, players on cleaning court are unavailable.');
    });
});
