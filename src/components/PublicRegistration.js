import React, { useState, useEffect } from 'react';
import { useAPI } from '../hooks/useAPI';

const PublicRegistration = ({ slug }) => {
  const api = useAPI();
  const [orgName, setOrgName] = useState('');
  const [activeTournament, setActiveTournament] = useState(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'form' | 'success' | 'error' | 'submitting' | 'hub'
  const [errorMsg, setErrorMsg] = useState('');

  // Roster & Bracket states loaded silency
  const [bracket, setBracket] = useState(null);
  const [players, setPlayers] = useState([]);

  // Registration Form State
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    rating: '',
    gender: 'male',
    email: '',
    phone: '',
    duprId: '',
    waiverSigned: false,
    ageCategory: 'adult'
  });

  // Lookup login states
  const [showLookup, setShowLookup] = useState(false);
  const [lookupValue, setLookupValue] = useState('');

  // Player Hub active session states
  const [activePlayer, setActivePlayer] = useState(null);
  const [hubTab, setHubTab] = useState('pass'); // 'pass' | 'eta' | 'selfie' | 'stats' | 'matchmaker' | 'chat' | 'journey' | 'trophy'

  // Voice Check-In Speech States
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceResult, setVoiceResult] = useState('');

  // Selfie Canvas Generator States
  const [selfieImage, setSelfieImage] = useState(null);
  const [selfieFilter, setSelfieFilter] = useState('none'); // 'none' | 'sepia' | 'cool' | 'glow'
  const [selfiePartner, setSelfiePartner] = useState('');

  // Partner Tactics Chat States
  const [uniformColor, setUniformColor] = useState('Stealth Black');
  const [partnerUniform, setPartnerUniform] = useState('Volt Lime');
  const [chatMessages, setChatMessages] = useState([
    { sender: 'Partner', text: 'Hey! Ready for the tournament today?', ts: Date.now() - 600000 },
    { sender: 'Partner', text: 'I am thinking we wear the Volt Lime shirts to match, what do you think?', ts: Date.now() - 500000 }
  ]);
  const [newMsg, setNewMsg] = useState('');

  // Singles Bulletin Board States
  const [matchmakerList, setMatchmakerList] = useState([
    { id: 'm1', name: 'Mike Miller', rating: 3.8, playstyle: 'Aggressive kitchen drives' },
    { id: 'm2', name: 'Sarah Jenkins', rating: 4.2, playstyle: 'Soft kitchen control' },
    { id: 'm3', name: 'David Thompson', rating: 3.5, playstyle: 'All-court balanced' }
  ]);
  const [myPlaystyle, setMyPlaystyle] = useState('');
  const [isListedInMatchmaker, setIsListedInMatchmaker] = useState(false);

  // 1. Initial Slug & Organization load
  const fetchOrg = async (isSilent = false) => {
    try {
      if (!isSilent) setStatus('loading');
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/public/join/${slug}`);
      if (!response.ok) {
        throw new Error('Invalid or expired registration link');
      }
      const data = await response.json();
      setOrgName(data.orgName);
      if (data.activeTournament) {
        setActiveTournament(data.activeTournament);
      }
      if (!isSilent) setStatus('form');
    } catch (err) {
      if (!isSilent) {
        setStatus('error');
        setErrorMsg(err.message);
      }
    }
  };

  // 2. Silent bracket & roster poller
  const fetchBracketData = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/public/bracket/${slug}`);
      if (response.ok) {
        const data = await response.json();
        if (data.activeTournament) {
          setBracket(data.activeTournament.bracket);
          const roster = data.activeTournament.players || [];
          setPlayers(roster);

          // Update activePlayer metadata dynamically if already logged into Hub
          if (activePlayer) {
            const fresh = roster.find(p => p.id === activePlayer.id || p.email === activePlayer.email || p.phone === activePlayer.phone);
            if (fresh) {
              setActivePlayer(fresh);
            }
          }
        }
      }
    } catch (e) {
      console.error('Bracket lookup failed:', e);
    }
  };

  useEffect(() => {
    fetchOrg();
    fetchBracketData();
  }, [slug]);

  // Periodic 15-second background poller
  useEffect(() => {
    const interval = setInterval(() => {
      fetchBracketData();
    }, 15000);
    return () => clearInterval(interval);
  }, [slug, activePlayer]);

  // Handle Speech Recognition for Hands-free check-in
  const startVoiceCheckIn = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please check in manually!");
      return;
    }

    if (voiceListening) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    recognition.onstart = () => {
      setVoiceListening(true);
      setVoiceResult('Listening for name...');
    };

    recognition.onerror = (event) => {
      setVoiceListening(false);
      setVoiceResult('Recognition error: ' + event.error);
    };

    recognition.onend = () => {
      setVoiceListening(false);
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setVoiceResult(`Heard: "${transcript}"`);

      const cleanTranscript = transcript.toLowerCase().replace(/[^a-z0-9]/g, '');
      const cleanPlayerName = activePlayer.name.toLowerCase().replace(/[^a-z0-9]/g, '');

      // Check if they said checkin/present or their name
      const isMatch = cleanTranscript.includes('check') || cleanTranscript.includes('present') || cleanTranscript.includes(cleanPlayerName);

      if (isMatch) {
        // Trigger synthetic success beep chime
        if (window.AudioContext || window.webkitAudioContext) {
          try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.15);
          } catch (e) {}
        }

        // Update local present states
        activePlayer.present = true;
        setPlayers(prev => prev.map(p => p.id === activePlayer.id ? { ...p, present: true } : p));
        alert(`🎉 Voice Match Confirmed! Checked in: ${activePlayer.name}!`);
      } else {
        alert(`Voice check-in failed. We heard "${transcript}". Please try again saying: "Check in ${activePlayer.name}"`);
      }
    };

    recognition.start();
  };

  // Graphic selfie photo generator
  const handleSelfieUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setSelfieImage(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const generateAndDownloadSelfie = () => {
    const canvas = document.getElementById('selfieCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Solid dark background
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, 1080, 1080);

    const drawOverlayDecorations = () => {
      // Glassmorphic Gradient Overlay
      const gradient = ctx.createLinearGradient(0, 450, 0, 1080);
      gradient.addColorStop(0, 'rgba(2, 6, 23, 0.1)');
      gradient.addColorStop(0.5, 'rgba(2, 6, 23, 0.75)');
      gradient.addColorStop(1, 'rgba(2, 6, 23, 0.98)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 1080, 1080);

      // Neon lime border
      ctx.strokeStyle = '#d6f060';
      ctx.lineWidth = 18;
      ctx.strokeRect(35, 35, 1010, 1010);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 2;
      ctx.strokeRect(45, 45, 990, 990);

      // Compositing typography overlay
      ctx.textAlign = 'center';

      // Title
      ctx.font = '900 52px sans-serif';
      ctx.fillStyle = '#d6f060';
      ctx.fillText('SMASHBOARD OPEN 2026', 1080 / 2, 850);

      // Name
      ctx.font = '900 64px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(activePlayer.name.toUpperCase(), 1080 / 2, 930);

      // Subtitles
      ctx.font = 'bold 32px sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      const partnerText = selfiePartner ? `Doubles Partner: ${selfiePartner}` : `Verified Rating: DUPR ${activePlayer.rating}`;
      ctx.fillText(partnerText, 1080 / 2, 980);

      ctx.font = 'bold 20px sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.fillText('OFFICIAL TOURNAMENT COMPETITOR', 1080 / 2, 1025);

      // Trigger standard browser download
      const link = document.createElement('a');
      link.download = `smashboard_competitor_${activePlayer.name.toLowerCase().replace(/\s+/g, '_')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };

    if (selfieImage) {
      const img = new Image();
      img.onload = () => {
        // cover image scaling
        const ratio = Math.max(1080 / img.width, 1080 / img.height);
        const w = img.width * ratio;
        const h = img.height * ratio;
        const x = (1080 - w) / 2;
        const y = (1080 - h) / 2;
        ctx.drawImage(img, x, y, w, h);

        if (selfieFilter === 'sepia') {
          ctx.fillStyle = 'rgba(230, 190, 120, 0.25)';
          ctx.fillRect(0, 0, 1080, 1080);
        } else if (selfieFilter === 'cool') {
          ctx.fillStyle = 'rgba(100, 180, 240, 0.2)';
          ctx.fillRect(0, 0, 1080, 1080);
        } else if (selfieFilter === 'glow') {
          ctx.fillStyle = 'rgba(214, 240, 96, 0.15)';
          ctx.fillRect(0, 0, 1080, 1080);
        }

        drawOverlayDecorations();
      };
      img.src = selfieImage;
    } else {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(50, 50, 980, 980);
      drawOverlayDecorations();
    }
  };

  // Match State Tracker
  const getPlayerMatchState = () => {
    if (!bracket) return { status: 'none', match: null, court: null };

    const winnersMatches = bracket.winnersMatches || [];
    const consolationMatches = bracket.consolationMatches || [];
    const grandFinalsMatches = bracket.grandFinalsMatches || [];
    const allMatches = [...winnersMatches, ...consolationMatches, ...grandFinalsMatches];

    const playerMatches = allMatches.filter(m =>
      m.team1?.name?.toLowerCase().includes(activePlayer.name.toLowerCase()) ||
      m.team2?.name?.toLowerCase().includes(activePlayer.name.toLowerCase())
    );

    const activeMatch = playerMatches.find(m => m.status === 'scheduled' || m.status === 'playing');
    if (!activeMatch) return { status: 'none', match: null, court: null };

    const courtAssignments = bracket.courtAssignments || [];
    const assignedCourt = courtAssignments.find(c => c.matchId === activeMatch.id);

    if (assignedCourt) {
      return { status: 'active', match: activeMatch, court: assignedCourt };
    }

    const activeMatchIds = courtAssignments.filter(c => c.matchId).map(c => c.matchId);
    const standbyMatches = allMatches.filter(match => {
      if (match.status !== 'scheduled') return false;
      if (!match.team1 || !match.team2) return false;
      if (match.team1.name === 'TBD' || match.team2.name === 'TBD') return false;
      if (match.team1.name === 'BYE' || match.team2.name === 'BYE') return false;
      return !activeMatchIds.includes(match.id);
    });

    const queueIndex = standbyMatches.findIndex(m => m.id === activeMatch.id);
    return { status: 'standby', match: activeMatch, queuePos: queueIndex !== -1 ? queueIndex + 1 : 1 };
  };

  const matchState = activePlayer ? getPlayerMatchState() : { status: 'none' };

  // Validation checkers for main sign up
  const getValidationError = () => {
    if (!activeTournament) return null;

    const allowedGender = activeTournament.restricted_gender || 'all';
    if (allowedGender !== 'all') {
      const playerGender = (form.gender || 'male').toLowerCase();
      if (allowedGender === 'men' && playerGender !== 'male') {
        return "Registration locked: This tournament is restricted to Men's divisions only.";
      }
      if (allowedGender === 'women' && playerGender !== 'female') {
        return "Registration locked: This tournament is restricted to Women's divisions only.";
      }
    }

    const allowedAge = activeTournament.restricted_age || 'all';
    if (allowedAge !== 'all') {
      const playerAge = (form.ageCategory || 'adult').toLowerCase();
      if (allowedAge === 'juniors' && playerAge !== 'junior') {
        return "Registration locked: This tournament is restricted to Juniors (Under 18) only.";
      }
      if (allowedAge === 'adults' && playerAge !== 'adult') {
        return "Registration locked: This tournament is restricted to Adults (18-49) only.";
      }
      if (allowedAge === 'seniors' && playerAge !== 'senior') {
        return "Registration locked: This tournament is restricted to Seniors (50+) only.";
      }
    }

    const allowedSkill = activeTournament.restricted_skill || 'all';
    if (allowedSkill !== 'all' && form.rating) {
      const playerRating = parseFloat(form.rating);
      if (!isNaN(playerRating)) {
        let minRating = 0;
        let maxRating = 10;
        let skillLabel = "";

        if (allowedSkill === '2.5-2.9') { minRating = 2.5; maxRating = 2.99; skillLabel = "Novice (2.5-2.99)"; }
        else if (allowedSkill === '3.0-3.4') { minRating = 3.0; maxRating = 3.49; skillLabel = "Intermediate (3.0-3.49)"; }
        else if (allowedSkill === '3.5-3.9') { minRating = 3.5; maxRating = 3.99; skillLabel = "High Intermediate (3.5-3.99)"; }
        else if (allowedSkill === '4.0-4.4') { minRating = 4.0; maxRating = 4.49; skillLabel = "Advanced (4.0-4.49)"; }
        else if (allowedSkill === '4.5-5.0') { minRating = 4.5; maxRating = 5.09; skillLabel = "High Advanced (4.5-5.09)"; }
        else if (allowedSkill === 'semi_pro') { minRating = 5.1; maxRating = 5.49; skillLabel = "Semi-Pro (5.1-5.49)"; }
        else if (allowedSkill === 'pro') { minRating = 5.5; maxRating = 10.0; skillLabel = "Professional (5.5+)"; }

        if (skillLabel && (playerRating < minRating || playerRating > maxRating)) {
          return `Registration locked: This tournament is restricted to the ${skillLabel} skill division.`;
        }
      }
    }

    return null;
  };

  const validationError = getValidationError();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (validationError) {
      return alert(validationError);
    }
    if (!form.firstName || !form.rating) {
      return alert("First name and rating are required");
    }
    if (!form.waiverSigned) {
      return alert("You must sign the Liability Waiver and Terms to register.");
    }

    try {
      setStatus('submitting');
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/public/join/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to register');
      }

      const data = await response.json();

      // Immediately log newly registered player into the Live Player Hub session!
      if (data.player) {
        setActivePlayer({
          id: data.player.id,
          name: data.player.player_name,
          rating: data.player.dupr_rating,
          gender: data.player.gender,
          email: data.player.email,
          phone: data.player.phone,
          duprId: data.player.dupr_id,
          present: false
        });
        setStatus('hub');
        setHubTab('pass');
        await fetchBracketData(); // refresh roster list immediately
      } else {
        setStatus('success');
      }
    } catch (err) {
      alert(`Registration failed: ${err.message}`);
      setStatus('form');
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-secondary"></div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 p-4">
        <div className="bg-slate-900 rounded-3xl p-8 max-w-md w-full text-center border border-slate-800">
          <div className="text-4xl mb-4">🔗</div>
          <h2 className="text-xl font-bold text-white mb-2">Link Invalid</h2>
          <p className="text-slate-400 mb-6 text-sm">{errorMsg}</p>
          <button
            onClick={() => window.location.href = '/'}
            className="w-full bg-brand-secondary text-brand-primary font-black py-3 px-4 rounded-xl hover:bg-[#d6f060] transition-colors uppercase tracking-wider text-xs"
          >
            Go to Homepage
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // 🏆 PREMIUM PLAYER HUB GLASSMORPHIC LAYOUT
  // -------------------------------------------------------------
  if (status === 'hub' && activePlayer) {
    return (
      <div className="min-h-screen bg-slate-950 text-white font-sans flex flex-col justify-between overflow-x-hidden">
        
        {/* Hub Sticky Top Banner */}
        <div className="p-4 sm:p-5 bg-slate-900/60 border border-slate-800/80 rounded-3xl m-4 sm:m-6 flex flex-wrap gap-4 items-center justify-between shadow-xl backdrop-blur-md select-none">
          <div className="flex items-center gap-3">
            <div className="relative">
              <span className="h-3 w-3 rounded-full bg-brand-secondary block animate-pulse" />
              <span className="absolute inset-0 h-3 w-3 rounded-full bg-brand-secondary block animate-ping opacity-75" />
            </div>
            <div>
              <div className="text-[9px] font-black tracking-widest uppercase text-brand-secondary leading-none mb-0.5">COMPETITOR HUB</div>
              <h2 className="text-sm font-black text-white">{activePlayer.name}</h2>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-bold">
            <span className="bg-slate-950/60 border border-slate-800 px-3 py-1 rounded-xl block">
              DUPR <span className="text-brand-secondary font-black ml-0.5">{activePlayer.rating}</span>
            </span>
            <span className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider block
              ${activePlayer.present ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'}`}>
              {activePlayer.present ? '✓ Checked In' : '● Checked Out'}
            </span>
            <button
              onClick={() => {
                setActivePlayer(null);
                setStatus('form');
              }}
              className="bg-slate-800 hover:bg-slate-700 transition-colors px-3 py-1.5 rounded-xl uppercase tracking-wider text-[9px] font-black"
            >
              Exit Hub
            </button>
          </div>
        </div>

        {/* Tab Controls Menu */}
        <div className="px-4 sm:px-6 overflow-x-auto flex gap-2 select-none py-1 scrollbar-none">
          {[
            { id: 'pass', label: '🎫 Ticket & Checkin' },
            { id: 'eta', label: '⏳ Queue ETA' },
            { id: 'selfie', label: '📸 Selfie Gen' },
            { id: 'stats', label: '📊 Skill Analytics' },
            { id: 'matchmaker', label: '🤝 Matchmaker' },
            { id: 'chat', label: '💬 Partner Chat' },
            { id: 'journey', label: '🗺️ Bracket Journey' },
            { id: 'trophy', label: '🏆 Awards shelf' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setHubTab(tab.id)}
              className={`flex-shrink-0 px-4 py-2 text-xs font-black rounded-2xl transition-all uppercase tracking-wider border
                ${hubTab === tab.id
                  ? 'bg-brand-secondary text-brand-primary border-brand-secondary shadow-[0_4px_20px_rgba(214,240,96,0.15)] scale-102'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Dynamic Tab Body */}
        <div className="flex-1 p-4 sm:p-6 max-w-lg w-full mx-auto flex flex-col justify-center">
          
          {/* TAB 1: 🎫 PLAYER PASS & SPEECH CHECKIN */}
          {hubTab === 'pass' && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-3xl text-center space-y-4 shadow-xl relative overflow-hidden backdrop-blur-sm">
                
                {/* Glowing pass corner tags */}
                <div className="absolute top-4 left-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">SmashBoard Pass</div>
                <div className="absolute top-4 right-4 text-[9px] font-black text-brand-secondary uppercase tracking-widest">Competitor</div>

                <div className="pt-6 pb-2">
                  <h3 className="text-2xl font-black uppercase text-white leading-tight">{activePlayer.name}</h3>
                  <p className="text-[10px] text-slate-400 font-extrabold tracking-wider uppercase mt-1">Division: Open DUPR {activePlayer.rating}</p>
                </div>

                {/* 3D Simulated SVG Ticket QR Barcode */}
                <div className="py-2 flex justify-center">
                  <svg className="w-36 h-36 bg-white p-2.5 rounded-2xl shadow-lg border border-slate-700/20" viewBox="0 0 100 100">
                    <rect x="5" y="5" width="22" height="22" fill="black" />
                    <rect x="9" y="9" width="14" height="14" fill="white" />
                    <rect x="11" y="11" width="10" height="10" fill="black" />
                    
                    <rect x="73" y="5" width="22" height="22" fill="black" />
                    <rect x="77" y="9" width="14" height="14" fill="white" />
                    <rect x="79" y="11" width="10" height="10" fill="black" />
                    
                    <rect x="5" y="73" width="22" height="22" fill="black" />
                    <rect x="9" y="77" width="14" height="14" fill="white" />
                    <rect x="11" y="79" width="10" height="10" fill="black" />
                    
                    <rect x="32" y="12" width="6" height="6" fill="black" />
                    <rect x="42" y="6" width="12" height="10" fill="black" />
                    <rect x="38" y="22" width="18" height="6" fill="black" />
                    <rect x="14" y="38" width="10" height="16" fill="black" />
                    <rect x="28" y="32" width="12" height="12" fill="black" />
                    <rect x="48" y="38" width="28" height="18" fill="black" />
                    <rect x="78" y="32" width="10" height="10" fill="black" />
                    <rect x="82" y="48" width="8" height="16" fill="black" />
                    <rect x="14" y="58" width="16" height="6" fill="black" />
                    <rect x="32" y="62" width="28" height="10" fill="black" />
                    <rect x="68" y="68" width="22" height="22" fill="black" />
                    <rect x="72" y="72" width="14" height="14" fill="white" />
                  </svg>
                </div>

                <div className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest">
                  ID: PASS-{activePlayer.id ? activePlayer.id.substring(0,8) : 'TEMP'}
                </div>
              </div>

              {/* 🎙️ Voice Check-In Mic widget */}
              {!activePlayer.present ? (
                <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-3xl text-center space-y-4 shadow-xl backdrop-blur-sm">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Speech-Enabled Presence Check-in</span>
                  <h4 className="text-xs font-black uppercase text-white tracking-wider">🎙️ Voice check-in</h4>

                  <div className="flex justify-center">
                    <button
                      onClick={startVoiceCheckIn}
                      className={`w-14 h-14 rounded-full flex items-center justify-center transition-all border outline-none
                        ${voiceListening 
                          ? 'bg-red-500/20 border-red-500 animate-pulse text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]' 
                          : 'bg-brand-secondary/20 border-brand-secondary/40 text-brand-secondary hover:bg-brand-secondary/30'}`}
                    >
                      <span className="text-xl">{voiceListening ? '🛑' : '🎙️'}</span>
                    </button>
                  </div>

                  <div className="text-[11px] font-bold text-slate-400 min-h-[32px] flex flex-col justify-center leading-normal">
                    {voiceListening ? (
                      <span className="text-red-400 font-black animate-pulse uppercase tracking-wider">Listening... Say: "Check in {activePlayer.name.split(' ')[0]}"</span>
                    ) : voiceResult ? (
                      <span className="text-brand-secondary font-black uppercase tracking-wider">{voiceResult}</span>
                    ) : (
                      <span>Tap mic and say "Check in {activePlayer.name}" to check in present!</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-green-500/10 border border-green-500/20 p-5 rounded-3xl text-center shadow-xl select-none">
                  <span className="text-3xl block mb-1">🎉</span>
                  <h4 className="text-sm font-black text-green-400 uppercase tracking-widest">You are fully Checked In present!</h4>
                  <p className="text-[10px] text-slate-400 mt-1 font-semibold">Staff scanner has confirmed your pass. Enjoy the matches!</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ⏳ LIVE MATCH ETA COUNTDOWN */}
          {hubTab === 'eta' && (
            <div className="space-y-4 animate-fade-in">
              {/* Rain weather delay notification */}
              {bracket?.delayMinutes > 0 && (
                <div className="bg-orange-500/20 border border-orange-500/30 p-4 rounded-3xl text-orange-300 space-y-1 animate-pulse">
                  <div className="text-xs font-black uppercase tracking-wider">🌦️ Weather Delay Active</div>
                  <p className="text-[10px] leading-relaxed font-semibold">
                    The tournament is currently delayed by <span className="font-black text-white">+{bracket.delayMinutes} minutes</span> due to court conditions. Estimated match ETAs are shifted.
                  </p>
                </div>
              )}

              {matchState.status === 'active' && (
                <div className="bg-slate-900 border border-brand-secondary/40 rounded-3xl p-6 space-y-4 shadow-xl text-center">
                  <span className="text-[9px] font-black text-brand-secondary uppercase tracking-widest block animate-pulse">★ YOUR MATCH IS ACTIVE ON COURT ★</span>
                  <div>
                    <h3 className="text-3xl font-black text-white">Court {matchState.court.courtNumber}</h3>
                    <div className="text-[9px] text-brand-secondary font-black uppercase tracking-widest mt-1 bg-brand-secondary/10 px-3 py-0.5 rounded-full inline-block">
                      {matchState.court.timerMode === 'warmup' ? 'Warm-up Mode' : 'Match Play'}
                    </div>
                  </div>
                  <div className="border-t border-slate-800 pt-4 flex flex-col justify-center items-center gap-2">
                    <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">{matchState.match.id}</span>
                    <div className="text-sm font-black text-white">
                      {matchState.match.team1.name}
                      <span className="text-brand-secondary block text-xs my-1 font-semibold">vs</span>
                      {matchState.match.team2.name}
                    </div>
                  </div>
                </div>
              )}

              {matchState.status === 'standby' && (
                <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-3xl text-center space-y-4 shadow-xl backdrop-blur-sm">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">ON DECK / STANDBY</span>
                  <div>
                    <h3 className="text-3xl font-black text-brand-secondary">Queue Position #{matchState.queuePos}</h3>
                    <p className="text-[10px] text-slate-400 mt-1 font-semibold">Matches ahead of you: {matchState.queuePos - 1}</p>
                  </div>
                  <div className="border-t border-slate-800 pt-4 text-xs font-bold text-slate-400">
                    Estimated play start in ~<span className="text-white font-extrabold">{matchState.queuePos * 12} mins</span>. Please stay nearby the court zone.
                  </div>
                </div>
              )}

              {matchState.status === 'none' && (
                <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-3xl text-center space-y-4 shadow-xl backdrop-blur-sm py-10 select-none">
                  <span className="text-4xl block mb-1">📋</span>
                  <h4 className="text-sm font-black text-slate-400 uppercase tracking-wider">No Active Schedule Pairings</h4>
                  <p className="text-[10px] text-slate-500 max-w-[240px] mx-auto leading-normal">
                    You have no active matches assigned on court or queued on deck. The bracket pairings are in progress!
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: 📸 SELFIE CARD GENERATOR */}
          {hubTab === 'selfie' && (
            <div className="space-y-4 animate-fade-in text-center">
              <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-3xl space-y-4 shadow-xl backdrop-blur-sm text-left">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Compositing Pass Generator</span>
                
                <div className="grid grid-cols-2 gap-3 text-xs font-bold text-slate-300">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400">Upload Photo</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleSelfieUpload}
                      className="w-full text-[10px] bg-slate-950 border border-slate-800 rounded-xl px-2 py-1.5 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400">Filter Tone</label>
                    <select
                      value={selfieFilter}
                      onChange={(e) => setSelfieFilter(e.target.value)}
                      className="w-full text-[10px] h-8 bg-slate-950 border border-slate-800 rounded-xl px-2 focus:outline-none"
                    >
                      <option value="none">No Filter</option>
                      <option value="sepia">Warm Sepia</option>
                      <option value="cool">Cool Cobalt</option>
                      <option value="glow">Neon Glow</option>
                    </select>
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400">Partner Name (Optional)</label>
                    <input
                      type="text"
                      value={selfiePartner}
                      onChange={(e) => setSelfiePartner(e.target.value)}
                      className="w-full text-[10px] h-8 bg-slate-950 border border-slate-800 rounded-xl px-3 focus:outline-none"
                      placeholder="Jane Smith"
                    />
                  </div>
                </div>

                {/* Simulated Graphic Frame Preview */}
                <div className="mt-4 border border-slate-800 rounded-3xl overflow-hidden relative w-full aspect-square bg-slate-950 flex items-center justify-center select-none shadow-inner">
                  {selfieImage ? (
                    <img 
                      src={selfieImage} 
                      alt="Selfie preview" 
                      className="w-full h-full object-cover"
                      style={{
                        filter: selfieFilter === 'sepia' ? 'sepia(0.6) hue-rotate(20deg)' : selfieFilter === 'cool' ? 'cyan(0.2) saturate(1.2)' : selfieFilter === 'glow' ? 'saturate(1.5) contrast(1.1)' : 'none'
                      }}
                    />
                  ) : (
                    <div className="text-center text-slate-700 flex flex-col items-center">
                      <span className="text-5xl mb-2">📸</span>
                      <span className="text-[10px] font-black uppercase tracking-widest">Image Standby</span>
                    </div>
                  )}
                  
                  {/* Decorative glassmorphic layout overlays */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/98 via-slate-950/40 to-transparent flex flex-col justify-end p-6 border-[8px] border-brand-secondary/40 rounded-3xl text-center">
                    <span className="text-[14px] font-black tracking-widest text-brand-secondary uppercase">SMASHBOARD OPEN 2026</span>
                    <h4 className="text-[20px] font-black text-white leading-none mt-1">{activePlayer.name.toUpperCase()}</h4>
                    <p className="text-[10px] text-slate-400 mt-1.5 font-bold uppercase tracking-wider">
                      {selfiePartner ? `Doubles Partner: ${selfiePartner}` : `Division: DUPR ${activePlayer.rating}`}
                    </p>
                  </div>
                </div>

                <button
                  onClick={generateAndDownloadSelfie}
                  className="w-full bg-brand-secondary hover:bg-[#d6f060] text-brand-primary font-black py-2.5 rounded-xl uppercase tracking-wider text-xs shadow-lg mt-4 transition-colors"
                >
                  ⚡ Download Competitor Graphic
                </button>
              </div>

              {/* Secret canvas for compositor export */}
              <canvas id="selfieCanvas" width="1080" height="1080" className="hidden" />
            </div>
          )}

          {/* TAB 4: 📊 SKILL RADAR ANALYTICS */}
          {hubTab === 'stats' && (
            <div className="space-y-6 animate-fade-in text-center select-none">
              <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-3xl space-y-4 shadow-xl backdrop-blur-sm relative">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Verifiable Skill Telemetry</span>
                
                {/* SVG Radar polygonal stats chart */}
                <svg className="w-56 h-56 mx-auto" viewBox="0 0 200 200">
                  <polygon points="100,20 180,80 150,170 50,170 20,80" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                  <polygon points="100,50 156,92 135,150 65,150 44,92" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                  <polygon points="100,80 128,104 120,130 80,130 72,104" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                  
                  {/* Grid diagonal axes */}
                  <line x1="100" y1="100" x2="100" y2="20" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                  <line x1="100" y1="100" x2="180" y2="80" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                  <line x1="100" y1="100" x2="150" y2="170" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                  <line x1="100" y1="100" x2="50" y2="170" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                  <line x1="100" y1="100" x2="20" y2="80" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />

                  {/* Corner Labels */}
                  <text x="100" y="14" fill="rgba(255,255,255,0.5)" fontSize="8" fontWeight="black" textAnchor="middle">CONSISTENCY</text>
                  <text x="186" y="80" fill="rgba(255,255,255,0.5)" fontSize="8" fontWeight="black" textAnchor="start">POWER</text>
                  <text x="156" y="180" fill="rgba(255,255,255,0.5)" fontSize="8" fontWeight="black" textAnchor="middle">SOFT GAME</text>
                  <text x="44" y="180" fill="rgba(255,255,255,0.5)" fontSize="8" fontWeight="black" textAnchor="middle">SPEED</text>
                  <text x="14" y="80" fill="rgba(255,255,255,0.5)" fontSize="8" fontWeight="black" textAnchor="end">STAMINA</text>

                  {/* Dynamic player metrics polygon: [Consistency 88%, Power 74%, Soft 85%, Speed 82%, Stamina 70%] */}
                  <polygon
                    points="100,29.6 159.2,85.2 142.5,159.5 59,157.4 44,86"
                    fill="rgba(214,240,96,0.22)"
                    stroke="#d6f060"
                    strokeWidth="2.5"
                    className="animate-pulse"
                  />
                </svg>

                <div className="grid grid-cols-3 gap-3 border-t border-slate-800/80 pt-4 text-xs font-extrabold text-slate-400">
                  <div className="text-center">
                    <span className="text-[10px] text-slate-500 block leading-none mb-0.5">Games Won</span>
                    <span className="text-white font-black text-sm">3</span>
                  </div>
                  <div className="text-center">
                    <span className="text-[10px] text-slate-500 block leading-none mb-0.5">Points Diff</span>
                    <span className="text-green-400 font-black text-sm">+18</span>
                  </div>
                  <div className="text-center">
                    <span className="text-[10px] text-slate-500 block leading-none mb-0.5">Win Streak</span>
                    <span className="text-brand-secondary font-black text-sm">🔥 2</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: 🤝 SINGLES MATCHMAKER DIRECTORY */}
          {hubTab === 'matchmaker' && (
            <div className="space-y-4 animate-fade-in text-left">
              <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-3xl space-y-4 shadow-xl backdrop-blur-sm">
                <div className="flex justify-between items-center select-none">
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">🤝 Doubles Matchmaker</h3>
                    <p className="text-[9px] text-slate-500 uppercase tracking-widest mt-0.5">Singles looking for partner pairing</p>
                  </div>
                  <span className="bg-brand-secondary/20 text-brand-secondary text-[8px] font-black px-2 py-0.5 rounded">
                    {matchmakerList.length} STANDBY
                  </span>
                </div>

                <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                  {matchmakerList.map(item => (
                    <div key={item.id} className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-2xl flex justify-between items-center text-xs">
                      <div>
                        <div className="font-extrabold text-white">{item.name}</div>
                        <div className="text-[9px] text-slate-400 mt-0.5 font-semibold">DUPR {item.rating} • {item.playstyle}</div>
                      </div>
                      <button
                        onClick={() => alert(`Merge request sent to ${item.name}! Check partner coordinator tab for active chat status.`)}
                        className="bg-brand-secondary hover:bg-[#d6f060] text-brand-primary font-black text-[9px] px-3.5 py-1.5 rounded-lg uppercase tracking-wider transition-colors"
                      >
                        Invite
                      </button>
                    </div>
                  ))}
                </div>

                <div className="border-t border-slate-800/80 pt-4 space-y-2 select-none">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">List My Profile in bulletin</label>
                  
                  {isListedInMatchmaker ? (
                    <div className="bg-green-500/10 border border-green-500/20 p-2.5 rounded-xl flex justify-between items-center text-xs text-green-400 font-extrabold">
                      <span>✓ Your Profile Listed Live!</span>
                      <button
                        onClick={() => setIsListedInMatchmaker(false)}
                        className="text-red-400 hover:text-red-300 font-black text-[9px] uppercase tracking-widest"
                      >
                        [Remove]
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={myPlaystyle}
                        onChange={(e) => setMyPlaystyle(e.target.value)}
                        placeholder="e.g. Backhand spin specialist"
                        className="flex-1 h-9 bg-slate-950 border border-slate-800 rounded-xl px-3 text-[10px] text-white focus:outline-none"
                      />
                      <button
                        onClick={() => {
                          if (!myPlaystyle) return alert('Please enter your playstyle specialty first.');
                          setMatchmakerList(prev => [...prev, {
                            id: `m-${Date.now()}`,
                            name: activePlayer.name,
                            rating: activePlayer.rating,
                            playstyle: myPlaystyle
                          }]);
                          setIsListedInMatchmaker(true);
                          setMyPlaystyle('');
                        }}
                        className="bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-[9px] px-4 rounded-xl uppercase tracking-widest transition-colors"
                      >
                        List Me
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: 💬 PARTNER UNIFORM CHAT */}
          {hubTab === 'chat' && (
            <div className="space-y-4 animate-fade-in text-left flex flex-col justify-between h-[380px]">
              
              {/* Partner Uniform selector widgets */}
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl grid grid-cols-2 gap-3 text-xs shadow-lg select-none">
                <div>
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">My Jersey Pick</span>
                  <div className="flex items-center gap-2">
                    <span 
                      className="w-3.5 h-3.5 rounded-full border border-white/20 block"
                      style={{ backgroundColor: uniformColor === 'Volt Lime' ? '#d6f060' : uniformColor === 'Stealth Black' ? '#0f172a' : '#f43f5e' }}
                    />
                    <select
                      value={uniformColor}
                      onChange={(e) => setUniformColor(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-lg text-[10px] px-2 h-7 focus:outline-none font-bold text-white uppercase tracking-wider"
                    >
                      <option value="Volt Lime">Volt Lime</option>
                      <option value="Stealth Black">Stealth Black</option>
                      <option value="Hyper Crimson">Hyper Crimson</option>
                    </select>
                  </div>
                </div>

                <div>
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Partner Jersey Pick</span>
                  <div className="flex items-center gap-2">
                    <span 
                      className="w-3.5 h-3.5 rounded-full border border-white/20 block"
                      style={{ backgroundColor: partnerUniform === 'Volt Lime' ? '#d6f060' : partnerUniform === 'Stealth Black' ? '#0f172a' : '#f43f5e' }}
                    />
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{partnerUniform}</span>
                  </div>
                </div>
              </div>

              {/* Chat thread feed viewport */}
              <div className="flex-1 bg-slate-900/60 border border-slate-800 rounded-3xl p-4 my-2.5 overflow-y-auto space-y-2 flex flex-col justify-end">
                {chatMessages.map((msg, i) => (
                  <div 
                    key={i} 
                    className={`max-w-[75%] rounded-2xl p-3 text-xs leading-normal font-semibold
                      ${msg.sender === 'Partner' 
                        ? 'bg-slate-800 text-slate-100 mr-auto rounded-tl-none border border-slate-700/60' 
                        : 'bg-brand-secondary text-brand-primary ml-auto rounded-tr-none font-extrabold shadow-sm'}`}
                  >
                    <div className="text-[8px] font-black uppercase opacity-60 leading-none mb-1">{msg.sender}</div>
                    <div>{msg.text}</div>
                  </div>
                ))}
              </div>

              {/* Chat Input panel */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMsg}
                  onChange={(e) => setNewMsg(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newMsg.trim()) {
                      setChatMessages(prev => [...prev, { sender: activePlayer.name.split(' ')[0], text: newMsg, ts: Date.now() }]);
                      setNewMsg('');
                      // simulated Partner answer
                      setTimeout(() => {
                        setChatMessages(prev => [...prev, { sender: 'Partner', text: 'Sounds perfect, let\'s hit the kitchen lines!', ts: Date.now() }]);
                      }, 1200);
                    }
                  }}
                  placeholder="Send partner coordination text..."
                  className="flex-1 h-10 bg-slate-900 border border-slate-800 rounded-xl px-4 text-xs text-white focus:outline-none focus:ring-1 focus:ring-brand-secondary"
                />
                <button
                  onClick={() => {
                    if (!newMsg.trim()) return;
                    setChatMessages(prev => [...prev, { sender: activePlayer.name.split(' ')[0], text: newMsg, ts: Date.now() }]);
                    setNewMsg('');
                    setTimeout(() => {
                      setChatMessages(prev => [...prev, { sender: 'Partner', text: 'Sounds like a great dink coordination strategy!', ts: Date.now() }]);
                    }, 1200);
                  }}
                  className="bg-brand-secondary hover:bg-[#d6f060] text-brand-primary font-black px-4 rounded-xl text-xs uppercase tracking-wider transition-colors"
                >
                  Send
                </button>
              </div>

            </div>
          )}

          {/* TAB 7: 🗺️ BRACKET JOURNEY MAP */}
          {hubTab === 'journey' && (
            <div className="space-y-6 animate-fade-in text-center select-none">
              <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-3xl space-y-5 shadow-xl backdrop-blur-sm">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Bracket Run Journey Tracker</span>
                
                {/* Visual horizontal journey timeline map */}
                <div className="flex justify-between items-center relative py-6 px-2">
                  <div className="absolute h-0.5 bg-slate-800 w-full left-0 top-1/2 -translate-y-1/2 z-0" />
                  
                  {/* Round 1 node */}
                  <div className="relative z-10 flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-green-500 text-white font-extrabold flex items-center justify-center text-xs shadow-lg border-2 border-slate-950">
                      1
                    </div>
                    <span className="text-[8px] font-black uppercase text-slate-400 mt-2 tracking-widest block">Round 1</span>
                    <span className="text-[7px] font-bold text-green-400 block mt-0.5 leading-none">W (11-6)</span>
                  </div>

                  {/* Round 2 node */}
                  <div className="relative z-10 flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-green-500 text-white font-extrabold flex items-center justify-center text-xs shadow-lg border-2 border-slate-950">
                      2
                    </div>
                    <span className="text-[8px] font-black uppercase text-slate-400 mt-2 tracking-widest block">Quarters</span>
                    <span className="text-[7px] font-bold text-green-400 block mt-0.5 leading-none">W (11-9)</span>
                  </div>

                  {/* Round 3 node (Semi-finals active) */}
                  <div className="relative z-10 flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-brand-secondary text-brand-primary font-black flex items-center justify-center text-xs shadow-lg border-2 border-brand-secondary animate-pulse">
                      3
                    </div>
                    <span className="text-[8px] font-black uppercase text-brand-secondary mt-2 tracking-widest block animate-pulse">Semis</span>
                    <span className="text-[7px] font-extrabold text-brand-secondary block mt-0.5 leading-none">STANDBY</span>
                  </div>

                  {/* Finals node (Standby) */}
                  <div className="relative z-10 flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-slate-950 border border-slate-800 text-slate-600 font-extrabold flex items-center justify-center text-xs">
                      F
                    </div>
                    <span className="text-[8px] font-black uppercase text-slate-600 mt-2 tracking-widest block">Finals</span>
                    <span className="text-[7px] font-bold text-slate-600 block mt-0.5 leading-none">TBD</span>
                  </div>
                </div>

                <div className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wide leading-relaxed border-t border-slate-800 pt-4 max-w-[280px] mx-auto">
                  You are playing in the Winners bracket division trail. Win one more match to secure your spot in the Grand Finals!
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: 🏆 POST-TOURNAMENT DIGITAL AWARDS SHELF */}
          {hubTab === 'trophy' && (
            <div className="space-y-6 animate-fade-in text-center select-none">
              <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-3xl space-y-4 shadow-xl backdrop-blur-sm">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">My Digital Award Cabinet</span>
                
                {/* 3D Visual Glassmedals Trophy display */}
                <div className="grid grid-cols-3 gap-4 py-4">
                  {/* Participant Award Card */}
                  <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-2xl flex flex-col items-center space-y-2 shadow-lg">
                    <div className="text-3xl filter drop-shadow-[0_0_8px_rgba(255,255,255,0.1)]">🎖️</div>
                    <div>
                      <span className="text-[8px] font-black text-slate-400 block uppercase leading-none">PARTICIPATION</span>
                      <span className="text-[9px] text-white font-black block mt-1 uppercase tracking-wide">CERTIFIED</span>
                    </div>
                  </div>

                  {/* Gold Medal (Simulated locked status) */}
                  <div className="bg-slate-950/20 border border-dashed border-slate-800/50 p-3 rounded-2xl flex flex-col items-center space-y-2 opacity-30 select-none">
                    <div className="text-3xl filter grayscale opacity-45">🥇</div>
                    <div>
                      <span className="text-[8px] font-bold text-slate-500 block uppercase leading-none">CHAMPIONS</span>
                      <span className="text-[9px] text-slate-500 font-bold block mt-1 uppercase tracking-wide">LOCKED</span>
                    </div>
                  </div>

                  {/* Silver Medal (Simulated locked status) */}
                  <div className="bg-slate-950/20 border border-dashed border-slate-800/50 p-3 rounded-2xl flex flex-col items-center space-y-2 opacity-30 select-none">
                    <div className="text-3xl filter grayscale opacity-45">🥈</div>
                    <div>
                      <span className="text-[8px] font-bold text-slate-500 block uppercase leading-none">RUNNER UP</span>
                      <span className="text-[9px] text-slate-500 font-bold block mt-1 uppercase tracking-wide">LOCKED</span>
                    </div>
                  </div>
                </div>

                <div className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wide border-t border-slate-800/80 pt-4 leading-normal max-w-[240px] mx-auto">
                  Trophies unlock dynamically as matches are fully marked completed on host consoles!
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Dynamic event footer */}
        <div className="text-center py-5 border-t border-slate-900 select-none">
          <a href="https://dinksync.com" target="_blank" rel="noopener noreferrer" className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors uppercase tracking-widest">
            Powered by DinkSync
          </a>
        </div>

      </div>
    );
  }

  // -------------------------------------------------------------
  // 📝 STANDARD REGISTRATION FORM
  // -------------------------------------------------------------
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-950 font-sans p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl my-8 relative overflow-hidden text-white">
        
        {/* Glow light details */}
        <div className="absolute -top-10 -left-10 w-32 h-32 bg-brand-secondary/10 rounded-full blur-2xl" />

        {/* Header content */}
        <div className="text-center mb-6 select-none">
          <div className="bg-brand-secondary text-brand-primary w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-[0_4px_20px_rgba(214,240,96,0.2)]">
            <span className="text-3xl font-black leading-none pb-1 font-serif italic">d</span>
          </div>
          <h1 className="text-[10px] font-black text-brand-secondary uppercase tracking-widest mb-1">Event Registration</h1>
          <h2 className="text-xl font-black text-white leading-tight">Join {orgName}</h2>
          {activeTournament && (
            <p className="text-xs text-slate-400 mt-1.5 font-bold bg-slate-950 border border-slate-800 py-1 px-4 rounded-full inline-block">
              Event: <span className="text-white font-extrabold">{activeTournament.tournament_name}</span>
            </p>
          )}
        </div>

        {/* Division constraints info */}
        {activeTournament && (
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 mb-6 space-y-2 text-xs">
            <div className="font-black text-slate-400 uppercase tracking-widest text-[9px]">Active Division Constraints</div>
            <div className="grid grid-cols-3 gap-2 text-[10px] font-bold select-none text-slate-300">
              <div>
                <span className="text-slate-500 block text-[9px] uppercase tracking-wide leading-none mb-0.5">Skill level</span>
                <span className="capitalize text-white">{activeTournament.restricted_skill === 'all' ? 'Open' : activeTournament.restricted_skill}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px] uppercase tracking-wide leading-none mb-0.5">Age limit</span>
                <span className="capitalize text-white">{activeTournament.restricted_age === 'all' ? 'All Ages' : activeTournament.restricted_age}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px] uppercase tracking-wide leading-none mb-0.5">Gender</span>
                <span className="capitalize text-white">{activeTournament.restricted_gender === 'all' ? 'Open' : activeTournament.restricted_gender === 'men' ? "Men Only" : "Women Only"}</span>
              </div>
            </div>
          </div>
        )}

        {/* Lockout Warning Banner */}
        {validationError && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 mb-6 flex items-start space-x-3 text-red-400 animate-pulse">
            <span className="text-xl leading-none">🔒</span>
            <div className="text-xs font-semibold leading-relaxed">
              <div className="font-black uppercase tracking-widest text-[9px] mb-0.5">Registration Locked Out</div>
              <p>{validationError}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-xs font-bold">
            <div className="space-y-1">
              <label className="uppercase tracking-widest text-[9px] text-slate-400 ml-1">First Name</label>
              <input
                type="text"
                required
                disabled={!!validationError}
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                className="w-full h-11 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-brand-secondary transition-all disabled:opacity-50 text-xs"
                placeholder="Jane"
              />
            </div>
            <div className="space-y-1">
              <label className="uppercase tracking-widest text-[9px] text-slate-400 ml-1">Last Name</label>
              <input
                type="text"
                disabled={!!validationError}
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                className="w-full h-11 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-brand-secondary transition-all disabled:opacity-50 text-xs"
                placeholder="Smith"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs font-bold">
            <div className="space-y-1">
              <label className="uppercase tracking-widest text-[9px] text-slate-400 ml-1">DUPR Rating</label>
              <input
                type="number"
                required
                step="0.01"
                min="2.0"
                max="8.0"
                disabled={!!validationError}
                value={form.rating}
                onChange={(e) => setForm({ ...form, rating: e.target.value })}
                className="w-full h-11 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-brand-secondary transition-all disabled:opacity-50 text-xs"
                placeholder="e.g. 3.5"
              />
            </div>
            <div className="space-y-1">
              <label className="uppercase tracking-widest text-[9px] text-slate-400 ml-1">DUPR ID</label>
              <input
                type="text"
                disabled={!!validationError}
                value={form.duprId}
                onChange={(e) => setForm({ ...form, duprId: e.target.value })}
                className="w-full h-11 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-brand-secondary transition-all disabled:opacity-50 text-xs"
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs font-bold">
            <div className="space-y-1">
              <label className="uppercase tracking-widest text-[9px] text-slate-400 ml-1">Gender</label>
              <select
                value={form.gender}
                disabled={!!validationError}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
                className="w-full h-11 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-1 focus:ring-brand-secondary transition-all disabled:opacity-50 text-xs appearance-none"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="uppercase tracking-widest text-[9px] text-slate-400 ml-1">Age division</label>
              <select
                value={form.ageCategory}
                disabled={!!validationError}
                onChange={(e) => setForm({ ...form, ageCategory: e.target.value })}
                className="w-full h-11 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-1 focus:ring-brand-secondary transition-all disabled:opacity-50 text-xs appearance-none"
              >
                <option value="junior">Junior (Under 18)</option>
                <option value="adult">Adult (18-49)</option>
                <option value="senior">Senior (50+)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs font-bold">
            <div className="space-y-1">
              <label className="uppercase tracking-widest text-[9px] text-slate-400 ml-1">Email</label>
              <input
                type="email"
                required
                disabled={!!validationError}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full h-11 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-brand-secondary transition-all disabled:opacity-50 text-xs"
                placeholder="you@email.com"
              />
            </div>
            <div className="space-y-1">
              <label className="uppercase tracking-widest text-[9px] text-slate-400 ml-1">Phone</label>
              <input
                type="tel"
                required
                disabled={!!validationError}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full h-11 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-brand-secondary transition-all disabled:opacity-50 text-xs"
                placeholder="(555) 000-0000"
              />
            </div>
          </div>

          {/* Waiver checkbox */}
          <div className="border border-slate-800 bg-slate-950/40 rounded-2xl p-4 space-y-2 mt-4">
            <div className="flex items-start space-x-3">
              <input
                id="waiverSigned"
                type="checkbox"
                required
                disabled={!!validationError}
                checked={form.waiverSigned}
                onChange={(e) => setForm({ ...form, waiverSigned: e.target.checked })}
                className="mt-1.5 h-4 w-4 rounded border-slate-800 text-brand-secondary bg-slate-950 focus:ring-brand-secondary focus:outline-none cursor-pointer"
              />
              <label htmlFor="waiverSigned" className="text-[10px] text-slate-400 leading-relaxed cursor-pointer select-none font-semibold">
                I agree to the <a href="/terms" target="_blank" className="font-extrabold text-white underline hover:text-brand-secondary transition-colors">Terms of Service</a> and the <a href="/waiver" target="_blank" className="font-extrabold text-white underline hover:text-brand-secondary transition-colors">Liability Waiver</a>. I certify my credentials are correct.
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={status === 'submitting' || !!validationError}
            className="w-full h-12 bg-brand-secondary text-brand-primary font-black text-sm rounded-xl hover:bg-[#d6f060] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-30 disabled:hover:translate-y-0 transition-all mt-6 shadow-lg shadow-brand-secondary/5 uppercase tracking-wider"
          >
            {status === 'submitting' ? 'Registering...' : 'Register & Launch Hub'}
          </button>
        </form>

        {/* 🎟️ Already Registered? Access Hub Panel */}
        <button
          type="button"
          onClick={() => {
            setShowLookup(prev => !prev);
            setLookupValue('');
          }}
          className="w-full py-2 bg-slate-950/40 hover:bg-slate-950 text-slate-400 hover:text-white font-extrabold text-[10px] rounded-xl transition-all uppercase tracking-widest border border-dashed border-slate-800 mt-3 select-none"
        >
          {showLookup ? '✕ Hide Access Panel' : '🎟️ Already Registered? Access Player Hub'}
        </button>

        {showLookup && (
          <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl mt-3 space-y-3 animate-fade-in text-left">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Registered Email or Phone</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={lookupValue}
                onChange={(e) => setLookupValue(e.target.value)}
                className="flex-1 h-10 border border-slate-800 rounded-xl px-3 text-xs bg-slate-900 text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-brand-secondary"
                placeholder="you@email.com or (555) 000-0000"
              />
              <button
                type="button"
                onClick={() => {
                  if (!lookupValue) return alert('Please enter your email or phone.');
                  
                  // Search in loaded players roster list
                  const target = players.find(p =>
                    p.email?.trim().toLowerCase() === lookupValue.trim().toLowerCase() ||
                    p.phone?.replace(/\D/g, '') === lookupValue.replace(/\D/g, '')
                  );

                  if (target) {
                    setActivePlayer({
                      id: target.id,
                      name: target.name || target.player_name,
                      rating: target.rating || target.dupr_rating,
                      gender: target.gender,
                      email: target.email,
                      phone: target.phone,
                      duprId: target.dupr_id,
                      present: target.present || false
                    });
                    setStatus('hub');
                    setHubTab('pass');
                  } else {
                    alert('No registered player found with that email or phone. Please verify or register!');
                  }
                }}
                className="bg-brand-secondary text-brand-primary hover:bg-[#d6f060] font-black px-4 rounded-xl text-xs uppercase tracking-wider transition-colors"
              >
                Access
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 text-center select-none">
          <a href="https://dinksync.com" target="_blank" rel="noopener noreferrer" className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors uppercase tracking-widest">
            Powered by DinkSync
          </a>
        </div>
      </div>
    </div>
  );
};

export default PublicRegistration;
