# Visitor Management System — User Manual

A complete guide to booking appointments, checking visitors in at reception and security posts, tracking movement across checkpoints, and analysing visitor activity — for every role on the team.

> This document is the text reference for the in-app help at `/help`. The web version adds interactive diagrams and screen mockups; keep this file updated whenever the manual changes so the exported PDF stays current.

## Overview

The platform connects everyone involved in a visit — the officer being visited, the front desk, and security at every checkpoint — around a single record that moves with the visitor from booking to exit.

Every visit follows one journey. An appointment is booked, an invitation with a QR code is sent to the visitor, the visitor is checked in at reception or first screened by security where the site requires it, security verifies them at each checkpoint they pass, the visitor goes to the office, conference room or other visit location, then passes the required security point again on the way out before final check-out. At every step the system records what happened and streams it live to the people who need to know.

The visit at a glance:

- **Plan the visit** — Capture the visitor, host, facility, office, category, purpose and visit window.
- **Issue the credential** — Send a QR token and short manual code after the visit is approved.
- **Admit and track** — Verify the visitor at reception and at staffed checkpoints as they move.
- **Close and report** — Check the visitor out, revoke temporary access and keep the visit auditable.

_Figure: The visitor journey — one record shared across reception, security and the host. (See the interactive diagram in the web manual.)_

> Reception, security and the visiting officer all see the same live status. Most sites send visitors straight to reception. Highly secured sites, such as central banks or restricted compounds, can add checkpoint scans before reception, into the secure area, between secure zones and again when the visitor leaves the secure area before check-out.

## Getting started

Use the system by choosing the task you need from the sidebar or from the correct staffed device. Visitors do not navigate the system; they only present their appointment QR code or complete the invitation link when asked.

This is an internal staff system: staff pages require sign-in and role permission. Post screens are designed for kiosks, tablets and guard desks, but they still require a staff member to unlock and operate the post. The table below explains where each person starts and what they should do next.

| Task                        | What to do                                                                                                                                                                                       | Audience |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| Read this manual            | From the sign-in page, select Help. After sign-in, use the Help item in the sidebar.                                                                                                             | staff    |
| Start work                  | Open VMS, sign in with your staff account, then use the sidebar to choose the area you need. The sidebar only shows pages your role is allowed to use.                                           | staff    |
| See expected visitors       | Choose Appointments in the sidebar. Use the filters to find visits by date, visitor, host, department, approval state or arrival state.                                                          | staff    |
| Book a visit                | Choose Appointments, then select New appointment. Enter the visitor, host, location, purpose and visit time, then submit for approval or invitation.                                             | booking  |
| Receive a visitor           | Choose Reception in the sidebar. Search the expected visit, scan the appointment QR code or enter the invitation code, verify the person, then complete assisted check-in.                       | desk     |
| Use a check-in post         | On the reception tablet or kiosk, a staff user signs in and unlocks the configured check-in post. The visitor presents their appointment QR code or invitation code to be scanned.               | post     |
| Visitor appointment QR      | The visitor receives this in their invitation. They do not browse the system; they only show the QR code to reception or security, or open the controlled pre-registration prompt when required. | visitor  |
| Check a visitor out         | From Reception or the exit device, scan the visitor badge, QR code or reusable tag. Confirm the visitor has left, collect any temporary credential, then complete check-out.                     | post     |
| Run a checkpoint            | At the guard post, sign in and open the checkpoint screen for that location. Scan the badge or QR code, review the verification result, then allow, deny or escalate according to policy.        | post     |
| Do a detailed security scan | Choose Security scan from the security workspace when you need fuller details such as host, department, purpose, expected time window, checkpoint and watchlist warning.                         | staff    |
| Monitor security operations | Choose Security in the sidebar to monitor incidents, overstays, denied entries, watchlist state and staffed checkpoint activity.                                                                 | staff    |
| Start emergency muster      | Choose Security, then Muster. Use the live on-site list to mark visitors accounted for, print the roll-call or export the list for the incident team.                                            | staff    |
| Complete pre-registration   | If the invitation asks for pre-registration, the visitor opens that invitation link, enters the required details and acknowledgements, then presents the QR code on arrival.                     | visitor  |
| Review reports              | Choose Reports in the sidebar. Search by visitor, host, date range, facility or status, then export only what your role and audit purpose require.                                               | staff    |
| Configure the system        | Administrators choose Administration in the sidebar to manage facilities, departments, offices, points, visitor categories, users, roles, devices and retention settings.                        | admin    |

> For fixed devices, administrators should configure the device profile under Administration, then label the device clearly, such as Reception check-in, Exit check-out or East Gate checkpoint. Staff should use the labelled device instead of typing addresses manually.

## Point and device setup

Use this section when preparing the reception desk, check-in tablet, check-out point or security checkpoint devices. These addresses are for setup staff and fixed devices, not for ordinary visitors.

First decide what the device is responsible for: reception desk work, arrival check-in, exit check-out, checkpoint scanning or security monitoring. Then open the matching address on that device and configure the device profile in Administration so the scanner, camera, printer and credential behavior match the hardware at that point.

> For most sites, configure Reception and Check-out first. For highly secured locations, add Security checkpoint devices at the gate, before visitors enter restricted visit areas, and where they return through security before final check-out.

In the addresses below, replace `<your-vms-address>` with your site's internal VMS web address.

| Point                  | Address and purpose                                                                                                                                                                                           | Audience |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Reception desk         | Use `<your-vms-address>/reception` on the front-desk computer. This is where reception searches expected visitors, completes assisted check-in, issues badges, monitors who is on-site and checks people out. | staff    |
| Arrival check-in point | Use `<your-vms-address>/check-in` on the reception tablet or kiosk. A staff member unlocks the post, then scans the visitor appointment QR code or enters the invitation code.                                | post     |
| Exit check-out point   | Use `<your-vms-address>/check-out` on the exit tablet or desk device. Scan the visitor QR code, badge or reusable tag, confirm the visitor has left, then collect the temporary credential.                   | post     |
| Security checkpoint    | Use `<your-vms-address>/checkpoint` at a guard post such as Main Gate or East Wing. The guard signs in, selects the configured checkpoint, scans the visitor credential and records passage.                  | post     |
| Detailed security scan | Use `<your-vms-address>/security/scan` where guards need fuller verification details before allowing passage, including host, purpose, department, time window and watchlist warnings.                        | staff    |
| Security console       | Use `<your-vms-address>/security` on the security office computer for incidents, overstays, denied entries, watchlist review and overall checkpoint monitoring.                                               | staff    |

### Points and devices are separate

A **point** is a fixed operating location, such as a reception desk or a security check-point. A **device** is the physical tablet stationed at that point. They are kept separate so the location keeps its identity, its staffing and the visitor trail even when the hardware changes: if a tablet is faulty, register a replacement device, point it at the same location and deactivate the old one. The point, its assigned staff and the visitor trail are unaffected. Manage them under Administration → Points and Administration → Devices.

### How to set up a staffed point

1. Sign in as an administrator and open Administration → Points.
2. Add the location and give it a clear name and kind, such as Main Reception (reception desk) or Main Gate (security check-point).
3. Open Administration → Devices and register the tablet: enter its device ID, choose the point it is stationed at, and set the scanner, camera, printer and credential options for that hardware.
4. Open the point's Staff list and tick the staff members allowed to operate it — only assigned staff can sign a device in there.
5. On the physical tablet, open the matching station address, run Kiosk setup once to record its device ID, then have an assigned staff member sign in.
6. Test the full flow with a real or test appointment: scan the QR code, print or assign the badge if used, then check the visitor out.

> Who can open a post: when a staff member signs in on a device, the system checks that they are assigned to the point that device is stationed at. If they are not, the post stays closed and no visitor can be processed there, even if their role would otherwise allow it. Administrators can always open any post for setup and inspection, and can see who is currently signed in where from the Devices screen.

### Device settings to confirm

| Setting              | What to do                                                                                                                                                                                                                                          |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tablet or kiosk      | Open the correct station address on the device browser, sign in with the assigned staff or station account, and label the device clearly. Keep it charged, connected to the internal network and placed where staff can supervise it.               |
| Camera or QR scanner | In Administration, open Devices and choose the scanner source for that point: built-in camera, USB scanner, NFC/tag reader or manual code entry. If the browser asks for camera access, allow it for VMS, then test with a real invitation QR code. |
| Badge printer        | Select the badge printer for the reception or exit point, choose the badge template and run a test print. Keep blank badges or labels near the printer and record a manual badge process for printer downtime.                                      |
| Reusable tags or NFC | If the site uses reusable credentials, enable the tag mode for that point, assign the tag at check-in and require staff to collect or deactivate it at check-out.                                                                                   |
| Point permissions    | Give each device or staff role only the actions needed at that point. Reception should not use a security checkpoint profile, and a checkpoint device should not be used for reports or administration.                                             |

> If a point does not use a camera, badge printer or reusable tag, leave that option disabled for that device profile. The staff screen should only show the tools that are actually available at the desk or checkpoint.

## Quick start by role

Start from the screen that matches your responsibility. The sidebar only shows the areas your role is allowed to use, so if you do not see a page, your role probably does not perform that task.

- **Host or officer** — Open Appointments to see your expected visitors. Use New appointment when you are inviting someone yourself, then watch the appointment detail page for approval state, invitation state and arrival updates.
- **Secretary** — Create and update visits for officers in your own office. Pick the department, office and officer carefully; the system scopes your booking permissions to that office.
- **Receptionist** — Keep Reception open during arrivals. Use assisted check-in for QR/code lookup, verify the visitor, issue badges or reusable tags, and check visitors out when they leave.
- **Security guard** — Use Security for incidents and the Checkpoint scan screen at posts. Scan the visitor credential, review the host, purpose, time window and watchlist warning, then allow or escalate.
- **Security manager** — Use Security for open incidents, overstays, watchlist management, checkpoint oversight, emergency muster and reports that support security review.
- **Administrator** — Set up facilities, departments, offices, checkpoints, visitor categories, device behavior, users, roles, date/time defaults and retention. Operational actions stay with reception and security.
- **Auditor** — Use Reports and Audit log for read-only oversight. Export only the information needed for the audit period and purpose.

> The system is intentionally role-limited. For example, administrators configure the platform but do not check visitors in; auditors can read reports but do not change visits; security guards can verify and resolve incidents but do not create appointments.

## Roles and who can book

Each role can only reach the functions it needs. Booking an appointment is limited to the front-office roles.

| Role                 | What they do                                                          | Can book? |
| -------------------- | --------------------------------------------------------------------- | --------- |
| Host / Officer       | Books their own visitors, approves requests, manages invitations      | Yes       |
| Secretary            | Books for officers in their own office only                           | Yes       |
| Receptionist         | Front desk: books walk-ins, checks visitors in and out, issues badges | Yes       |
| Security guard       | Operates checkpoints, scans and verifies, logs incidents              | No        |
| Security manager     | Approves visits, manages the watchlist and access, views reports      | No        |
| Auditor              | Read-only: visits, reports, audit log and analytics                   | No        |
| System administrator | Manages users and system configuration; read-only oversight           | No        |

Security and audit roles deliberately cannot create appointments, and the administrator manages accounts and configuration rather than day-to-day visits.

### Common visit statuses

| Status                                 | Meaning                                                                                        |
| -------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Draft                                  | A visit has been started but is not yet ready for an invitation.                               |
| Pending approval                       | The visit needs approval because of its category, area, risk, policy or other configured rule. |
| Approved                               | The visit may proceed. The system can issue or resend the invitation.                          |
| Invitation sent                        | The visitor has been sent a QR code and/or manual invitation code.                             |
| Pre-registered                         | The visitor completed required details and acknowledgements before arrival.                    |
| Checked in                             | The visitor is currently on-site and appears in live lists.                                    |
| Checked out                            | The visitor has left, the visit is closed, and any temporary credential should be inactive.    |
| Cancelled / denied / expired / no show | Terminal states used for visits that should not admit a visitor.                               |

## Booking an appointment

Hosts book their own visitors; secretaries book for the officers in their office; receptionists book walk-ins at the desk.

1. A host, secretary or receptionist opens New appointment and enters the visitor's name plus an email or phone number.
2. They pick the department, office and officer being visited, the purpose, date and time. The system blocks double-booking the officer, room or visitor.
3. If the visitor's category requires approval, the visit waits as Pending approval for the host or a security manager; otherwise it is approved immediately.
4. On approval an invitation is issued — a QR code and a short entry code are sent to the visitor by email and/or SMS.

Before you submit:

- Add either an email address or a phone number so the visitor can receive the invitation.
- Choose the department first, then the office, then the officer. This prevents bookings against the wrong host or room.
- Use the visitor category to trigger approval, escort or induction requirements where your site uses them.
- Set an estimated end time. This supports clash detection, overstay monitoring and emergency reporting.

_Figure: New appointment — capture the visitor, the officer and the time; the invitation is sent automatically. (See the screen mockup in the web manual.)_

**Visit status lifecycle.** These are the record statuses a visit moves through in the system — distinct from the physical checkpoints in the visitor journey on the Overview page: Draft, Pending approval, Approved, Invitation sent, Pre-registered, Checked in, Checked out.

## Pre-registration

Some visitor categories require the visitor to complete details or acknowledge policies before arrival. The invitation link takes them to a controlled pre-registration form; it is not an open portal into the system.

Pre-registration collects only the details configured for the visitor category, such as contact information, safety acknowledgements, induction confirmation or other policy fields. Once complete, the visit status changes to **Pre-registered** and reception can process the arrival faster.

- Visitors open the pre-registration link from their invitation.
- They review the host, location and facility address before submitting details.
- Required acknowledgements must be ticked before the form can be completed.
- Expired or invalid links show a controlled message and do not reveal private visit data.

> If the visitor reaches reception without completing pre-registration, the check-in flow will warn staff. Reception can continue only if site policy allows them to verify and capture the missing information at the desk.

## Security posts and checkpoints

Security checkpoints are optional and site-dependent. Many offices send visitors straight to reception; highly secured sites can add staffed guard points before reception, before entering restricted areas, when leaving those areas and at final exit.

- **Standard site** — The visitor goes straight to reception. Reception scans the QR or enters the code, verifies the person and issues the badge if used.
- **High-security gate** — A guard scans the appointment QR before reception, confirms the visit is expected, then directs the visitor to reception.
- **Restricted areas** — Security scans the visitor after reception before they enter the office, conference room or secure zone, then scans again when they leave that area.

The visitor presents the QR code from their invitation, or types the short entry code if they don't have the QR. The system checks the code is valid, within its time window, and allowed at that point. Use the configured checkpoint order for the site: a simple office may only use reception and check-out, while a highly secured place may require a gate scan before reception, a scan into the secure visit location, and a return scan before the final check-out.

_Figure: A security checkpoint verifying a visitor by QR or entry code. (See the screen mockup in the web manual.)_

## Reception desk

Reception is the live front-desk workspace for arrivals, departures, badge control and on-site reconciliation.

Keep the Reception page open during arrival periods. It shows KPI cards for visitors on-site, pre-registered, expected and pending approval, followed by assisted check-in, tag reconciliation and the live on-site list.

1. Ask the visitor for their QR code or manual invitation code.
2. Use Assisted check-in to scan or look up the code.
3. Review the visitor, host, facility, appointment time and any pre-registration warning.
4. Verify identity according to your site procedure, then choose Check in.
5. Issue the printed badge, QR credential or reusable tag shown by the device profile.
6. When the visitor leaves, scan their QR/tag or use the on-site list to check them out.

- **On-site now** — A live list of visitors currently inside, including host, badge and check-in time.
- **Tags out** — Reusable cards or NFC tags that have been issued and still need to be collected.
- **Badge handling** — Badges can be printed, tags can be issued, and badge/tag exceptions should be reconciled before close of day.
- **Host notification** — Checking in a visitor updates live dashboards and notifies the host through configured channels.

## Live tracking and dashboards

As a visitor scans at each checkpoint the system records a passage event, so their movement through the facility is visible in real time.

Each scan adds to the visitor's **checkpoint trail** — an ordered timeline of where they presented their credential. The visiting officer sees a live "At ..." badge on the appointment, and the security and reception dashboards keep an accurate on-site count. In an emergency, the muster list shows everyone currently inside with their contact details.

_Figure: The checkpoint trail — every post the visitor passed, in order, with timestamps. (See the screen mockup in the web manual.)_

## Security operations

Security uses the live console to monitor incidents, overstays, denied entries, watchlist state and staffed checkpoint scans.

- **Security dashboard** — Shows on-site count, open incidents, overstays and denied visits in the last 24 hours.
- **Open incidents** — Review active escalations, search by type or visitor, and resolve them once the security action is complete.
- **Watchlist** — Security managers add or remove blocked identities. Entries are matched securely so raw blocked values are not exposed in the list.
- **Checkpoint scan** — Guards scan a checked-in visitor at a post and see identity, host, department, purpose, time window and watchlist warning.

1. Open Security and review the KPI cards before shift handover.
2. Use Checkpoint scan at a staffed post when a visitor presents a badge, QR or code.
3. Compare the visitor in front of you with the displayed name, host, organization, visit purpose and expected window.
4. If the result is not verified, expired, wrong-location, duplicated or watchlisted, pause the visitor and follow the escalation procedure.
5. Resolve incidents only after the denial, escort, correction, checkout or other required action is complete.

## Emergency muster

Emergency muster is the live roll-call view for everyone currently checked in. It can be used on-screen, printed or exported during an evacuation or incident.

Open Security, then Emergency muster, when the site needs an immediate visitor headcount. The page refreshes regularly and shows each checked-in visitor, host, badge number and contact details where policy allows. Tap a row to mark a visitor accounted for; the progress summary updates as people are confirmed.

- Use the search box to find visitors by name, host or badge number.
- Mark visitors as accounted for only after direct confirmation from the muster point or responsible host.
- Export CSV when the response team needs an offline copy or later reconciliation.
- Use Print if electronic access may be unreliable during the incident.
- After the incident, reconcile remaining visitors in Reception or Security so the on-site list becomes accurate again.

## Visitor analytics

On the Reports page, analysts can drill into a single visitor to see how often they come and why.

Open Reports, then Visitor insights, and search for a visitor by name, organisation, email or phone. The drill-down shows how many times they have visited, a twelve-month **frequency timeline**, and a breakdown of the **purpose** of each visit — so you can see, for example, that a contractor came ten times, mostly for "Quarterly audit review". You also see which officers they visit most and a log of their recent visits.

_Figure: Visitor insights — visit frequency over time and a breakdown of visit purposes. (See the screen mockup in the web manual.)_

> Available to security managers, auditors and administrators (read-only oversight). Guards use the live security console; deep analytics live on Reports.

| Report           | What it shows                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------- |
| Daily volume     | A trend of checked-in visitors by day, useful for staffing reception and reviewing peak arrival patterns.     |
| Visits by status | A status mix showing checked-in, checked-out, pending, denied, expired, cancelled and other lifecycle states. |
| Visitor log      | A searchable operational record with visitor, host, facility, status, check-in and check-out times.           |
| Exports          | CSV and Excel exports are role-restricted and should be filtered to the date range needed before use.         |

## Notifications

Visitors and hosts are kept informed automatically over the channels you have configured.

- **Email** — Invitations with the QR code and entry link, plus reschedule and cancellation notices.
- **SMS** — The short entry code sent to local mobile numbers where the SMS gateway is enabled.
- **Reminders** — Pre-registration prompts when a visitor category requires details before arrival.

Email and SMS are sent independently and retried automatically, so a visitor still gets their invitation by email even if the SMS can't be delivered.

- Invitation messages include visit details, arrival instructions, a QR link and/or manual code.
- Arrival notifications tell the host when the visitor has checked in.
- Cancellation, reschedule, denial and expiry events keep the visitor record consistent even if a channel fails.
- Notification failures are logged for staff follow-up and retry; they do not corrupt the visit status.

## Administration

Administrators set up the building and the team; security managers tune day-to-day controls.

Set up Administration in the same order people move through the product: first the place, then the team, then visitor rules, then device behavior. That keeps the booking screens clean because departments, offices and officers appear in the right cascade.

- **Facilities, departments and offices** — Model your premises so bookings route to the right officer and room.
- **Points and devices** — Register each post and the tablet stationed at it, with its scanner and badge/printer behaviour.
- **Users and roles** — Invite staff (they set their own password) and assign least-privilege roles.
- **Visitor categories** — Decide which visit types need approval, escort or pre-registration.

1. System settings: set organization name, country, date format, timezone, retention days and voice settings.
2. Facilities: add each premises or site with a short code and timezone.
3. Departments and offices: create the organizational structure that hosts belong to.
4. Users: invite staff, assign least-privilege roles, and attach hosts/secretaries to their department and office.
5. Visitor categories: define which visit types require approval, escort or induction.
6. Points and devices: add each operating location, then register its device and choose scanner source, printer target and credential mode such as QR only, printed badge or reusable tag/NFC.

## Privacy and audit

Visitor data is operationally sensitive. The system is built to minimize exposure, separate duties by role, and preserve an audit trail for important actions.

- **No raw secrets in QR codes** — QR codes use opaque tokens or signed links. They should not contain raw personal data.
- **Least privilege** — Each role sees only the screens and actions needed for its duty, and read-only oversight cannot perform front-line work.
- **Retention** — Closed visitor records are retained only for the configured period, then anonymized or removed according to policy.
- **Audit trail** — Appointment changes, invitations, check-in/out, incidents, exports and admin changes are logged.

- Do not export more visitor data than the task requires.
- Do not store invitation codes, QR payloads, API keys or integration credentials in plain text outside the system.
- Use the Audit log for compliance review instead of informal screenshots where possible.
- When correcting visitor details, keep the correction reason clear enough for later review.

## Common exceptions

Most problems at the desk or checkpoint should be handled without breaking the audit trail. Use the controlled path first, then escalate when policy requires it.

| Situation                         | What to do                                                                                                                                                                |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Visitor forgot invitation         | Reception searches by visitor, company, host, phone/email or appointment time, verifies identity, then uses assisted check-in. Record the reason if an exception is made. |
| QR code will not scan             | Use the manual invitation code. If the visitor only has the email, reception can search the expected visits and complete the check-in after verification.                 |
| Invalid or repeated code attempts | The visitor-facing QR/code flow shows a controlled error. Repeated failures are rate-limited and logged; security should review if the attempts look suspicious.          |
| Pre-registration incomplete       | Ask the visitor to finish the link in their invitation. Reception may override only after verifying the missing information according to site policy.                     |
| Visitor arrives early or late     | Follow the configured arrival window. Outside that window, route to reception, host approval or security approval according to policy.                                    |
| Watchlist match                   | Do not complete the staff-assisted entry. Security is alerted; verify identity carefully and follow the controlled site procedure before allowing or denying passage.     |
| Badge printer or tag issue fails  | Issue a manual badge or tag if your procedure allows it, then reprint or reconcile once the device is available. The exception should remain auditable.                   |
| Visitor does not check out        | Use Reception, Security or Muster to reconcile on-site visitors. Collect reusable tags and close visits only after confirming the visitor has left.                       |
