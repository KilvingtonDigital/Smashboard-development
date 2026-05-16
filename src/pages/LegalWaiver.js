import React from 'react';

const LegalWaiver = () => {
  return (
    <div className="min-h-screen bg-brand-light p-4 sm:p-8 font-sans">
      <div className="max-w-3xl mx-auto bg-white rounded-3xl p-8 shadow-soft border border-brand-gray/30">
        <h1 className="text-3xl font-black text-brand-primary mb-6">Liability Waiver</h1>
        <div className="prose prose-sm max-w-none text-brand-primary/80 space-y-4">
          <p><strong>Last Updated: {new Date().toLocaleDateString()}</strong></p>
          
          <p>In consideration of being permitted to participate in any pickleball events, tournaments, or activities organized via the DinkSync platform ("Activities"), you acknowledge and agree to the following:</p>

          <h3 className="text-lg font-bold text-brand-primary mt-6">1. Assumption of Risk</h3>
          <p>You understand that participating in the Activities involves inherent risks, including but not limited to physical injury, illness, property damage, and death. You voluntarily assume all such risks associated with your participation.</p>

          <h3 className="text-lg font-bold text-brand-primary mt-6">2. Release of Liability</h3>
          <p>You hereby release, waive, discharge, and covenant not to sue the event organizers, venue owners, DinkSync, its affiliates, directors, officers, employees, and agents (collectively, the "Released Parties") from any and all liability, claims, demands, actions, or causes of action arising out of or related to any loss, damage, or injury that may be sustained by you while participating in the Activities.</p>

          <h3 className="text-lg font-bold text-brand-primary mt-6">3. Medical Consent</h3>
          <p>You certify that you are physically fit to participate in the Activities. In the event of an emergency, you authorize the event organizers to secure medical treatment on your behalf, and you agree to bear all costs associated with such treatment.</p>

          <h3 className="text-lg font-bold text-brand-primary mt-6">4. Media Release</h3>
          <p>You grant the Released Parties the right to photograph, record, or video you during the Activities and to use such media for promotional or commercial purposes without compensation.</p>

          <h3 className="text-lg font-bold text-brand-primary mt-6">5. Indemnification</h3>
          <p>You agree to indemnify and hold harmless the Released Parties from any loss, liability, damage, or costs, including court costs and attorney fees, that they may incur due to your participation in the Activities.</p>

          <div className="bg-brand-secondary/10 p-4 rounded-xl mt-8 border border-brand-secondary/30">
            <p className="font-semibold text-sm">By checking the consent box during registration, you acknowledge that you have read this waiver, fully understand its terms, and agree to be bound by them.</p>
          </div>
        </div>
      </div>
    </div>
   );
};

export default LegalWaiver;