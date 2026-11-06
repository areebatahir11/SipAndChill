// Terms & Conditions every business owner must accept before using the software.
// To publish new terms: edit the text, then change TERMS_VERSION. Every owner is asked to accept again on their next visit.
// Acceptances are stored per user and version (TermsAcceptance), so there is always proof of who agreed to what and when.

export const TERMS_VERSION = '2026-11-06';
export const TERMS_TITLE = 'Terms & Conditions';
export const TERMS_UPDATED = '6 November 2026';

export const TERMS_SECTIONS = [
  {
    heading: '1. About these terms',
    body: [
      'These terms are an agreement between your business ("you") and PearlSolutions ("we", "us"). They cover your use of our point-of-sale, menu, stock and reporting software (the "Service").',
      'The person who creates or receives the business account is the Business Owner and accepts these terms on behalf of the business. By clicking "I agree" you confirm that you have the authority to do so.',
    ],
  },
  {
    heading: '2. Your account',
    body: [
      'You are responsible for everything done through your business account, including the managers, cashiers and inventory staff you add. Give each person their own login and remove access when someone leaves.',
      'Keep passwords private. Tell us immediately if you think an account has been misused. You must give us true and current information about your business.',
    ],
  },
  {
    heading: '3. Approval, free trial and fees',
    body: [
      'New business accounts are reviewed and approved by PearlSolutions before use. We may approve or decline a request at our discretion.',
      'A free trial may be offered when your account is approved. After the trial, the monthly fee and due date agreed with you apply. Fees are shown in your agreement with PearlSolutions and may be changed with reasonable notice.',
      'Fees are paid in advance for each month. Fees already paid are not refundable unless we agree otherwise in writing.',
    ],
  },
  {
    heading: '4. Suspension and termination',
    body: [
      'We may suspend your business account, which signs out every user of your business, if: (a) a fee is unpaid after its due date and a reminder; (b) you break these terms or misuse the Service; (c) we reasonably believe the account is being used fraudulently or is a security risk; or (d) the law requires it.',
      'While an account is suspended nobody from your business can sign in. Your data is kept, and access is restored once the reason for suspension is resolved.',
      'You may stop using the Service at any time by telling us. We may end the Service for an account that stays suspended for a long period or that seriously or repeatedly breaks these terms.',
    ],
  },
  {
    heading: '5. Acceptable use',
    body: [
      'Use the Service only for running your own food and beverage business. You must not: share your login with outsiders, try to access another business\'s data, interfere with or overload the Service, copy or resell it, attempt to reverse-engineer it, or use it for anything unlawful.',
    ],
  },
  {
    heading: '6. Your data',
    body: [
      'Your menu, stock, orders, customers\' order records and reports belong to you. We keep each business\'s data separate from every other business and do not sell it.',
      'We use your data only to provide, secure and improve the Service, to contact you about your account, and where the law requires. PearlSolutions staff do not browse your shop data; platform administrators see only account, billing and access information.',
      'You are responsible for the accuracy of the prices, taxes, stock figures and receipts you create and for complying with the tax and business laws that apply to you.',
    ],
  },
  {
    heading: '7. Availability, backups and hardware',
    body: [
      'We work to keep the Service available and to back up your data, but we do not promise it will be uninterrupted or error-free. Plan for occasional downtime, for example by keeping a manual way to take orders.',
      'The Service depends on your internet connection, device and printer. We are not responsible for problems caused by them.',
    ],
  },
  {
    heading: '8. Limits of our responsibility',
    body: [
      'The Service is provided "as is". To the extent the law allows, we are not liable for lost sales, lost profit or indirect losses, and our total liability for any claim is limited to the fees you paid us in the three months before the claim arose.',
    ],
  },
  {
    heading: '9. Changes to these terms',
    body: [
      'We may update these terms. When we do, the Business Owner is asked to review and accept the new version the next time they sign in. If you do not accept, you may stop using the Service.',
    ],
  },
  {
    heading: '10. Law and contact',
    body: [
      'These terms are governed by the laws of Pakistan, and its courts have jurisdiction over any dispute. For any question about these terms, contact PearlSolutions using the contact details you were given when your account was set up.',
    ],
  },
];

/**
 * Must this person accept the current terms before using the app?
 * Only the Business Owner accepts, on behalf of the business; staff accounts are covered by that acceptance.
 * acceptedVersions: the versions this user has accepted.
 */
export function termsRequired({ roleCode, acceptedVersions = [] }, current = TERMS_VERSION) {
  return roleCode === 'OWNER' && !acceptedVersions.includes(current);
}
