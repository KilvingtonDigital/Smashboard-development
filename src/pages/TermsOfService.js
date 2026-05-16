import React from 'react';

const TermsOfService = () => {
  return (
    <div className="min-h-screen bg-brand-light p-4 sm:p-8 font-sans">
      <div className="max-w-3xl mx-auto bg-white rounded-3xl p-8 shadow-soft border border-brand-gray/30">
        <h1 className="text-3xl font-blaci-text-brand-primary mb-6">Terms of Service</h1>
        <div className="prose prose-sm max-w-none text-brand-primary/80 space-y-4">
          <p><strong>Last Updated: {new Date().toLocaleDateString()}</strong></p>
          
          <p>Welcome to DinkSync. These Terms of Service ("Terms") govern your access to and use of the DinkSync platform, including public registration links, tournament tracking, and related services.</p>

          <h3 className="text-lg font-bold text-brand-primary mt-6">1. Use of Service</h3>
          <p>DinkSync provides software for tournament organizers to manage brackets and registration. We do not directly organize, host, or insure the physical pickleball events. By using the service, you agree to provide accurate information (e.g., DUPR rating, name) and not to misuse the platform.</p>

          <h3 className="text-lg font-bold text-brand-primary mt-6">2. Data Privacy & Consent</h3>
          <p>When you register for an event, we collect your name, email, phone number, and self-reported ratings. This data is shared directly with the Tournament Organizer. By submitting your information, you consent to its collection and sharing for the purpose of event organization, communication, and scheduling.</p>

          <h3 className="text-lg font-bold text-brand-primary mt-6">3. DUP2 Integration</h3>
          <p>You agree that any DUP2 IDs or ratings provided may be used by the Tournament Organizer to verify skill levels and to upload official match results back to the DUP2 platform. DinkSync is an independent software tool and is not liable for how organizers manage or submit ratings.</p>

          <h3 className="text-lg font-bold text-brand-primary mt-6">4. SMS & Email Communications</h3>
          <p>By providing your email and phone number, you consent to receive transactional notifications regarding the tournament (e.g., match assignments, court changes) from the Organizer and DinkSync.</p>

          <h3 className="text-lg font-bold text-brand-primary mt-6">5. Limitation of Liability</h3>
          <p>DinkSync is provided "as is" without warranties of any kind. In no event shall DinkSync be liable for any direct, indirect, incidental, or consequential damages resulting from your use of the platform or participation in organized events.</p>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;