import { describe, expect, it } from 'vitest';
import { renderInvitationEmail, type InvitationEmailData } from './invitation.ts';

const base: InvitationEmailData = {
  organizationName: 'Jubilee House',
  brandLabel: 'Jubilee House (VMS)',
  logoCid: 'vms-logo',
  visitorName: 'Ama Mensah',
  hostName: 'Kofi Boateng',
  facilityName: 'Main Block',
  facilityAddress: '1 Independence Ave',
  visitDate: '12/07/2026 10:00',
  invitationCode: 'ABCD23',
  checkInUrl: 'https://vms.example/check-in?t=tok',
  preRegisterUrl: 'https://vms.example/pre-register?t=tok',
  qrCid: 'vms-qr',
};

describe('renderInvitationEmail — institution contact', () => {
  it('renders the contact line in html and text when an email + phone are set', () => {
    const { html, text } = renderInvitationEmail({
      ...base,
      contactEmail: 'visitors@jubilee.gov.gh',
      contactPhone: '+233 20 000 0000',
    });
    expect(text).toContain('Questions? Contact us at visitors@jubilee.gov.gh · +233 20 000 0000');
    expect(html).toContain('Questions? Contact us at visitors@jubilee.gov.gh · +233 20 000 0000');
  });

  it('renders the contact line with just one channel present', () => {
    const { html, text } = renderInvitationEmail({ ...base, contactEmail: 'help@x.gov' });
    expect(text).toContain('Questions? Contact us at help@x.gov');
    expect(html).toContain('Questions? Contact us at help@x.gov');
  });

  it('omits the contact line when no contact is configured', () => {
    const { html, text } = renderInvitationEmail(base);
    expect(text).not.toContain('Questions? Contact us at');
    expect(html).not.toContain('Questions? Contact us at');
  });
});
