import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useAPI } from '../hooks/useAPI';

const TournamentsDashboard = ({ onActivateTournament }) => {
  const { user } = useAuth();
  const api = useAPI();

  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [copiedId, setCopiedId] = useState('');
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrModalData, setQRModalData] = useState(null);
  const [copiedLobbyId, setCopiedLobbyId] = useState('');

  const [form, setForm] = useState({
    name: '',
    type: 'roundRobin',
    numCourts: 4,
    eventDate: ''
  });

  const loadTournaments = async () => {
    try {
      setLoading(true);
      const res = await api.tournaments.getAll();
      if (res.success) {
        setTournaments(res.data.tournaments);
      } else {
        setError(res.error || 'Failed to load tournaments');
      }
    } catch (err) {
      setError(err.message || 'An error occurred while fetching tournaments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTournaments();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name || !form.eventDate) {
      return alert('Event Name and Date are required.');
    }

    try {
      const payload = {
        tournament_name: form.name,
        tournament_type: form.type,
        num_courts: parseInt(form.numCourts, 10),
        event_date: form.eventDate,
        tournament_data: { players: [], rounds: [], matches: [], currentRound: 0 }
      };

      const res = await api.tournaments.create(payload);
      if (res.success) {
        setShowCreateModal(false);
        setForm({ name: '', type: 'roundRobin', numCourts: 4, eventDate: '' });
        loadTournaments();
      } else {
        alert(res.error || 'Failed to create tournament');
      }
    } catch (err) {
      alert(err.message || 'Error creating tournament');
    }
  };

  const handleActivate = async (id) => {
    try {
      const res = await api.fetchAPI(`/api/tournaments/${id}/activate`, { method: 'POST' });
      if (res.success) {
        onActivateTournament(id);
      } else {
        alert(res.error || 'Failed to activate session');
      }
    } catch (err) {
      alert(err.message || 'Error activating tournament');
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${name}"?\nThis will remove all registrations and scores.`)) {
      return;
    }

    try {
      const res = await api.tournaments.delete(id);
      if (res.success) {
        loadTournaments();
      } else {
        alert(res.error || 'Failed to delete tournament');
      }
    } catch (err) {
      alert(err.message || 'Error deleting tournament');
    }
  };

  const copyRegistrationLink = (e, id) => {
    e.stopPropagation();
    const link = `https://dinksync.app/join/${user?.registrationSlug}/${id}`;
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(''), 2000);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return { month: 'N/A', day: '--', year: 'No Date' };
    const date = new Date(dateStr);
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    return {
      month: months[date.getMonth()],
      day: date.getDate(),
      year: date.getFullYear()
    };
  };

  const getFormatLabel = (type) => {
    const formats = {
      roundRobin: 'Round Robin',
      kingOfCourt: 'King of Court',
      singles: 'Singles Matchup',
      doubles: 'Doubles Matchup',
      teamed_doubles: 'Teamed Doubles'
    };
    return formats[type] || type;
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans p-6 sm:p-10">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Upper Dashboard Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#222] pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xl">🏓</span>
              <span className="text-sm font-bold text-lime tracking-widest uppercase">DinkSync Console</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight">Tournaments Dashboard</h1>
            <p className="text-gray-400 text-sm mt-0.5">Manage your upcoming event schedule, advertising links, and active weekend court sessions.</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-lime text-black font-bold h-12 px-6 rounded-xl hover:bg-[#d6f060] active:scale-95 transition-all shadow-lg shadow-lime/10 flex items-center gap-2 whitespace-nowrap"
          >
            <span className="text-lg leading-none">+</span> Schedule Event
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl text-sm">
            ⚠️ {error}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lime"></div>
            <p className="text-gray-400 text-sm mt-4">Loading scheduled events...</p>
          </div>
        ) : tournaments.length === 0 ? (
          <div className="border border-[#222] bg-[#111]/30 rounded-3xl p-12 text-center max-w-xl mx-auto space-y-6">
            <div className="text-6xl">📅</div>
            <h2 className="text-2xl font-black">No Tournaments Scheduled</h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              Plan and advertise your events up to a year out. Players can sign up using a custom registration link for each date without impacting other events.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-lime text-black font-bold h-11 px-6 rounded-xl hover:bg-[#d6f060] transition-colors"
            >
              Create Your First Tournament
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tournaments.map((t) => {
              const { month, day, year } = formatDate(t.event_date);
              const isEventActive = t.is_active_session;
              const formatLabel = getFormatLabel(t.tournament_type);

              return (
                <div 
                  key={t.id} 
                  className={`relative rounded-3xl border transition-all duration-300 overflow-hidden flex flex-col justify-between ${
                    isEventActive 
                      ? 'bg-[#151a10] border-lime/30 shadow-lg shadow-lime/5' 
                      : 'bg-[#111]/60 border-[#222] hover:border-[#333] hover:shadow-[0_8px_30px_rgb(0,0,0,0.4)]'
                  }`}
                >
                  {/* Card upper body */}
                  <div className="p-6 space-y-5">
                    {/* Date and Badges row */}
                    <div className="flex justify-between items-start gap-4">
                      {/* Premium Calendar Date Block */}
                      <div className="w-14 h-14 rounded-2xl bg-black border border-[#222] flex flex-col items-center justify-center overflow-hidden flex-shrink-0">
                        <div className="bg-[#222] w-full text-[9px] font-black tracking-widest text-gray-400 text-center py-0.5 leading-none">{month}</div>
                        <div className="text-xl font-black text-white leading-none mt-1">{day}</div>
                        <div className="text-[7.5px] font-bold text-gray-500 mt-0.5">{year}</div>
                      </div>

                      {/* Status Pills */}
                      <div className="flex flex-col items-end gap-1.5">
                        {isEventActive ? (
                          <span className="bg-lime/20 text-lime border border-lime/30 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1.5 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-lime"></span> Active Session
                          </span>
                        ) : (
                          <span className="bg-[#222] text-gray-400 border border-[#333] text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                            Scheduled
                          </span>
                        )}
                        <span className="text-[11px] text-gray-400 font-bold bg-[#1a1a1a] border border-[#2e2e2e] px-2 py-0.5 rounded-lg">
                          👥 {t.player_count || 0} Registered
                        </span>
                      </div>
                    </div>

                    {/* Tournament Details */}
                    <div>
                      <h3 className="text-lg font-black tracking-tight text-white line-clamp-1 leading-snug">{t.tournament_name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-lime font-bold uppercase tracking-wider bg-lime/10 px-2 py-0.5 rounded-md">{formatLabel}</span>
                        <span className="text-xs text-gray-400 font-semibold">• {t.num_courts} Courts</span>
                      </div>
                    </div>
                  </div>

                  {/* Card footer buttons */}
                  <div className="p-6 pt-0 border-t border-[#222]/40 bg-black/20 space-y-3">
                    {/* Share / Copy Link and QR / TV buttons */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={(e) => copyRegistrationLink(e, t.id)}
                        className={`h-10 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all ${
                          copiedId === t.id
                            ? 'bg-lime/10 border-lime text-lime'
                            : 'bg-[#1a1a1a] border-[#2e2e2e] text-gray-300 hover:bg-[#252525] hover:text-white'
                        }`}
                      >
                        {copiedId === t.id ? '✓ Copied!' : '🔗 Join Link'}
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setQRModalData({ id: t.id, name: t.tournament_name });
                          setShowQRModal(true);
                        }}
                        className="h-10 rounded-xl font-bold text-xs bg-[#1a1a1a] border border-[#2e2e2e] text-gray-300 hover:bg-[#252525] hover:text-white flex items-center justify-center gap-2 transition-all"
                      >
                        📲 QR & TV Lobby
                      </button>
                    </div>

                    {/* Manage event button */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleActivate(t.id)}
                        className={`flex-1 h-11 rounded-xl font-black text-sm transition-all ${
                          isEventActive
                            ? 'bg-lime text-black hover:bg-[#d6f060] shadow-md shadow-lime/5'
                            : 'bg-white text-black hover:bg-gray-200'
                        }`}
                      >
                        {isEventActive ? 'Resume Session' : 'Start & Manage'}
                      </button>
                      <button
                        onClick={() => handleDelete(t.id, t.tournament_name)}
                        className="w-11 h-11 rounded-xl bg-[#ff3b30]/10 border border-[#ff3b30]/20 text-[#ff3b30] hover:bg-[#ff3b30] hover:text-white flex items-center justify-center transition-all flex-shrink-0"
                        title="Delete Tournament"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* CREATE TOURNAMENT MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#111] border border-[#222] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-[#222]">
              <h2 className="text-xl font-black tracking-tight">Schedule New Event</h2>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-white text-xl font-bold leading-none p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Event Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Summer Solstice Round Robin"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full h-11 bg-black border border-[#222] rounded-xl px-4 text-white text-sm focus:outline-none focus:border-lime transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Event Date</label>
                <input
                  type="date"
                  required
                  value={form.eventDate}
                  onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
                  className="w-full h-11 bg-black border border-[#222] rounded-xl px-4 text-white text-sm focus:outline-none focus:border-lime transition-all appearance-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Format</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full h-11 bg-black border border-[#222] rounded-xl px-4 text-white text-sm focus:outline-none focus:border-lime transition-all appearance-none"
                  >
                    <option value="roundRobin">Round Robin</option>
                    <option value="kingOfCourt">King of Court</option>
                    <option value="singles">Singles</option>
                    <option value="doubles">Doubles</option>
                    <option value="teamed_doubles">Teamed Doubles</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Courts Available</label>
                  <input
                    type="number"
                    min="1"
                    max="32"
                    required
                    value={form.numCourts}
                    onChange={(e) => setForm({ ...form, numCourts: e.target.value })}
                    className="w-full h-11 bg-black border border-[#222] rounded-xl px-4 text-white text-sm focus:outline-none focus:border-lime transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full h-12 bg-lime text-black font-black text-sm rounded-xl hover:bg-[#d6f060] active:scale-98 transition-all mt-6 shadow-md shadow-lime/5"
              >
                Schedule & Open Registration
              </button>
            </form>
          </div>
        </div>
      {/* CHECK-IN QR & LOBBY TV MODAL */}
      {showQRModal && qrModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#111] border border-[#222] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 text-center">
            <div className="flex justify-between items-center pb-4 border-b border-[#222]">
              <h2 className="text-lg font-black tracking-tight text-left leading-snug">
                Event check-in details<br/>
                <span className="text-xs font-bold text-gray-400">{qrModalData.name}</span>
              </h2>
              <button 
                onClick={() => {
                  setShowQRModal(false);
                  setQRModalData(null);
                }}
                className="text-gray-400 hover:text-white text-xl font-bold leading-none p-1"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col items-center space-y-4">
              <div className="bg-white p-3 rounded-2xl border-4 border-lime shadow-xl">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${window.location.origin}/join/${user?.registrationSlug}/${qrModalData.id}?checkin=true`)}`}
                  alt="Check-in QR Code"
                  className="w-48 h-48"
                />
              </div>
              <p className="text-xs font-semibold text-gray-400 max-w-[260px] leading-relaxed">
                Display this QR code at the check-in table. Players scan this to instantly check in from their mobile phones.
              </p>
            </div>

            <div className="space-y-2.5 pt-2">
              <button
                onClick={() => {
                  const checkinUrl = `${window.location.origin}/join/${user?.registrationSlug}/${qrModalData.id}?checkin=true`;
                  const printWindow = window.open('', '_blank');
                  printWindow.document.write(`
                    <html>
                      <head>
                        <title>Print Check-In Poster</title>
                        <style>
                          body { font-family: sans-serif; text-align: center; padding: 40px; color: #111; }
                          .container { max-width: 500px; margin: 0 auto; border: 4px solid #111; padding: 40px; border-radius: 24px; }
                          h1 { font-size: 32px; font-weight: 900; margin-bottom: 8px; }
                          p { font-size: 16px; font-weight: 600; color: #555; margin-bottom: 24px; }
                          img { width: 300px; height: 300px; margin: 20px 0; }
                          .footer { font-size: 12px; color: #999; margin-top: 30px; }
                        </style>
                      </head>
                      <body>
                        <div class="container">
                          <h1>Contactless Check-In</h1>
                          <p>Scan with your phone to sign in for <br/><strong>\${qrModalData.name}</strong></p>
                          <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(checkinUrl)}" />
                          <div class="footer">Powered by DinkSync</div>
                        </div>
                        <script>window.onload = function() { window.print(); }</script>
                      </body>
                    </html>
                  `);
                  printWindow.document.close();
                }}
                className="w-full h-11 bg-lime text-black font-black text-xs rounded-xl hover:bg-[#d6f060] transition-all flex items-center justify-center gap-2"
              >
                🖨️ Print Check-In Poster
              </button>

              <button
                onClick={() => {
                  const lobbyLink = `${window.location.origin}/lobby/${qrModalData.id}`;
                  navigator.clipboard.writeText(lobbyLink);
                  setCopiedLobbyId(qrModalData.id);
                  setTimeout(() => setCopiedLobbyId(''), 2000);
                }}
                className={`w-full h-11 rounded-xl font-bold text-xs border transition-all flex items-center justify-center gap-2 ${
                  copiedLobbyId === qrModalData.id
                    ? 'bg-lime/10 border-lime text-lime'
                    : 'bg-[#1a1a1a] border-[#2e2e2e] text-gray-300 hover:bg-[#252525] hover:text-white'
                }`}
              >
                {copiedLobbyId === qrModalData.id ? '✓ Lobby Link Copied!' : '📺 Copy Screencast TV Lobby Link'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TournamentsDashboard;
