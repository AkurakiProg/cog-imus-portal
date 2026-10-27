const fs = require('fs');
const path = require('path');
const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    Table,
    TableRow,
    TableCell,
    BorderStyle,
    WidthType,
    AlignmentType,
    ShadingType
} = require('docx');

async function createGuideDocx() {
    // Church color palette: Navy (#0E2A4F), Gold (#C9A961), Dark Gold (#A38136), Slate (#475569)
    const COLOR_NAVY = '0E2A4F';
    const COLOR_GOLD = 'A38136';
    const COLOR_LIGHT_GOLD = 'FDFBF7';
    const COLOR_SLATE = '334155';
    const COLOR_MUTED = '64748B';
    const COLOR_ALERT_BG = 'FEF3C7';
    const COLOR_ALERT_BORDER = 'F59E0B';
    const COLOR_ALERT_TEXT = '92400E';

    const doc = new Document({
        styles: {
            default: {
                document: {
                    run: {
                        font: 'Calibri',
                        size: 22, // 11pt
                        color: COLOR_SLATE
                    },
                    paragraph: {
                        spacing: {
                            line: 276, // 1.15 line spacing
                            before: 80,
                            after: 80
                        }
                    }
                }
            }
        },
        sections: [{
            properties: {
                page: {
                    margin: {
                        top: 1200, // ~0.83 in
                        right: 1200,
                        bottom: 1200,
                        left: 1200
                    }
                }
            },
            children: [
                // Header / Church Title
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 0, after: 60 },
                    children: [
                        new TextRun({
                            text: "CHURCH OF GOD WORLD MISSIONS - IMUS",
                            font: "Georgia",
                            size: 32, // 16pt
                            bold: true,
                            color: COLOR_NAVY
                        })
                    ]
                }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 0, after: 300 },
                    children: [
                        new TextRun({
                            text: "Official Website & Role-Based Portal Navigation Guide",
                            font: "Georgia",
                            size: 26, // 13pt
                            italics: true,
                            color: COLOR_GOLD
                        })
                    ]
                }),

                // IMPORTANT NOTICE BOX (SMS Maintenance Alert)
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    borders: {
                        top: { style: BorderStyle.SINGLE, size: 16, color: COLOR_ALERT_BORDER },
                        bottom: { style: BorderStyle.SINGLE, size: 16, color: COLOR_ALERT_BORDER },
                        left: { style: BorderStyle.SINGLE, size: 36, color: COLOR_ALERT_BORDER },
                        right: { style: BorderStyle.SINGLE, size: 16, color: COLOR_ALERT_BORDER }
                    },
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({
                                    shading: { type: ShadingType.CLEAR, fill: COLOR_ALERT_BG },
                                    margins: { top: 160, bottom: 160, left: 240, right: 240 },
                                    children: [
                                        new Paragraph({
                                            spacing: { before: 0, after: 80 },
                                            children: [
                                                new TextRun({
                                                    text: "⚠️ IMPORTANT NOTICE: SMS GATEWAY UNDER MAINTENANCE",
                                                    bold: true,
                                                    size: 22,
                                                    color: COLOR_ALERT_TEXT
                                                })
                                            ]
                                        }),
                                        new Paragraph({
                                            spacing: { before: 0, after: 80 },
                                            children: [
                                                new TextRun({
                                                    text: "Please be informed that cellular SMS broadcasting is currently undergoing scheduled maintenance / standby activation while our official registered Sender ID ",
                                                    size: 20,
                                                    color: COLOR_ALERT_TEXT
                                                }),
                                                new TextRun({
                                                    text: "COGIMUS",
                                                    bold: true,
                                                    size: 20,
                                                    color: COLOR_ALERT_TEXT
                                                }),
                                                new TextRun({
                                                    text: " is being approved by Philippine mobile carriers (Globe, Smart, DITO) via Semaphore in compliance with NTC anti-spam regulations.",
                                                    size: 20,
                                                    color: COLOR_ALERT_TEXT
                                                })
                                            ]
                                        }),
                                        new Paragraph({
                                            spacing: { before: 0, after: 0 },
                                            children: [
                                                new TextRun({
                                                    text: "• All Portal Accounts, Member Logins, Database Logs, and Verification Emails (powered by the Official Google Gmail REST API over secure HTTPS) are ",
                                                    size: 20,
                                                    color: COLOR_ALERT_TEXT
                                                }),
                                                new TextRun({
                                                    text: "100% active and operational.\n",
                                                    bold: true,
                                                    size: 20,
                                                    color: COLOR_ALERT_TEXT
                                                }),
                                                new TextRun({
                                                    text: "• Live SMS broadcasts will automatically resume nationwide as soon as carrier approval is completed.",
                                                    size: 20,
                                                    color: COLOR_ALERT_TEXT
                                                })
                                            ]
                                        })
                                    ]
                                })
                            ]
                        })
                    ]
                }),

                new Paragraph({ spacing: { before: 240, after: 120 }, text: "" }),

                // Section 1: Public Website Navigation
                new Paragraph({
                    heading: HeadingLevel.HEADING_1,
                    spacing: { before: 240, after: 120 },
                    children: [
                        new TextRun({ text: "1. Public Website Navigation", font: "Georgia", size: 28, bold: true, color: COLOR_NAVY })
                    ]
                }),
                new Paragraph({
                    children: [
                        new TextRun({
                            text: "The public website provides visitors, members, and online worshippers with information about church doctrine, Sunday service times, upcoming events, and ministry media."
                        })
                    ]
                }),

                // Public Website Table
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    borders: {
                        top: { style: BorderStyle.SINGLE, size: 6, color: 'CBD5E1' },
                        bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CBD5E1' },
                        left: { style: BorderStyle.NONE },
                        right: { style: BorderStyle.NONE },
                        insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' },
                        insideVertical: { style: BorderStyle.NONE }
                    },
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({
                                    shading: { type: ShadingType.CLEAR, fill: COLOR_NAVY },
                                    width: { size: 25, type: WidthType.PERCENTAGE },
                                    margins: { top: 120, bottom: 120, left: 140, right: 140 },
                                    children: [new Paragraph({ children: [new TextRun({ text: "Page / Route", bold: true, color: "FFFFFF" })] })]
                                }),
                                new TableCell({
                                    shading: { type: ShadingType.CLEAR, fill: COLOR_NAVY },
                                    width: { size: 75, type: WidthType.PERCENTAGE },
                                    margins: { top: 120, bottom: 120, left: 140, right: 140 },
                                    children: [new Paragraph({ children: [new TextRun({ text: "Description & Key Features", bold: true, color: "FFFFFF" })] })]
                                })
                            ]
                        }),
                        new TableRow({
                            children: [
                                new TableCell({
                                    margins: { top: 100, bottom: 100, left: 140, right: 140 },
                                    children: [new Paragraph({ children: [new TextRun({ text: "Home Page (/)", bold: true, color: COLOR_NAVY })] })]
                                }),
                                new TableCell({
                                    margins: { top: 100, bottom: 100, left: 140, right: 140 },
                                    children: [new Paragraph({ text: "Dynamic welcome hero banner, Scripture pill verse, worship service schedules, welcome video, and latest church news." })]
                                })
                            ]
                        }),
                        new TableRow({
                            children: [
                                new TableCell({
                                    margins: { top: 100, bottom: 100, left: 140, right: 140 },
                                    children: [new Paragraph({ children: [new TextRun({ text: "Sermons (/sermons)", bold: true, color: COLOR_NAVY })] })]
                                }),
                                new TableCell({
                                    margins: { top: 100, bottom: 100, left: 140, right: 140 },
                                    children: [new Paragraph({ text: "Video recordings archive, filtering by preacher and series, downloadable sermon notes, and responsive popup media player." })]
                                })
                            ]
                        }),
                        new TableRow({
                            children: [
                                new TableCell({
                                    margins: { top: 100, bottom: 100, left: 140, right: 140 },
                                    children: [new Paragraph({ children: [new TextRun({ text: "Events (/events)", bold: true, color: COLOR_NAVY })] })]
                                }),
                                new TableCell({
                                    margins: { top: 100, bottom: 100, left: 140, right: 140 },
                                    children: [new Paragraph({ text: "Church calendar, youth events, leadership conferences, retreats, and ministry training registration." })]
                                })
                            ]
                        }),
                        new TableRow({
                            children: [
                                new TableCell({
                                    margins: { top: 100, bottom: 100, left: 140, right: 140 },
                                    children: [new Paragraph({ children: [new TextRun({ text: "Gallery (/gallery)", bold: true, color: COLOR_NAVY })] })]
                                }),
                                new TableCell({
                                    margins: { top: 100, bottom: 100, left: 140, right: 140 },
                                    children: [new Paragraph({ text: "High-resolution photo albums from church anniversaries, water baptisms, fellowship gatherings, and youth camps with full lightbox view." })]
                                })
                            ]
                        }),
                        new TableRow({
                            children: [
                                new TableCell({
                                    margins: { top: 100, bottom: 100, left: 140, right: 140 },
                                    children: [new Paragraph({ children: [new TextRun({ text: "About Us (/history)", bold: true, color: COLOR_NAVY })] })]
                                }),
                                new TableCell({
                                    margins: { top: 100, bottom: 100, left: 140, right: 140 },
                                    children: [new Paragraph({ text: "Origins of Church of God Imus, foundational faith statement, pastoral leadership, and the WORDA ministry framework." })]
                                })
                            ]
                        }),
                        new TableRow({
                            children: [
                                new TableCell({
                                    margins: { top: 100, bottom: 100, left: 140, right: 140 },
                                    children: [new Paragraph({ children: [new TextRun({ text: "Contact (/contact)", bold: true, color: COLOR_NAVY })] })]
                                }),
                                new TableCell({
                                    margins: { top: 100, bottom: 100, left: 140, right: 140 },
                                    children: [new Paragraph({ text: "Church address, contact numbers, interactive location map, and direct prayer request submission form." })]
                                })
                            ]
                        })
                    ]
                }),

                // Section 2: Authentication & Security
                new Paragraph({
                    heading: HeadingLevel.HEADING_1,
                    spacing: { before: 300, after: 120 },
                    children: [
                        new TextRun({ text: "2. Portal Authentication & Security Access", font: "Georgia", size: 28, bold: true, color: COLOR_NAVY })
                    ]
                }),
                new Paragraph({
                    children: [
                        new TextRun({ text: "Access to the internal church dashboards is authenticated through " }),
                        new TextRun({ text: "/login", bold: true, color: COLOR_NAVY }),
                        new TextRun({ text: " with strict role-based access control (RBAC):" })
                    ]
                }),
                new Paragraph({
                    bullet: { level: 0 },
                    children: [
                        new TextRun({ text: "Unified Entrance: ", bold: true }),
                        new TextRun({ text: "Members, Church Leaders, and Administrators all sign in via the same portal login form." })
                    ]
                }),
                new Paragraph({
                    bullet: { level: 0 },
                    children: [
                        new TextRun({ text: "Data Privacy Consent: ", bold: true }),
                        new TextRun({ text: "Compliant with Republic Act 10173 (Data Privacy Act of 2012). Members must acknowledge and accept the privacy notice prior to viewing dashboard records." })
                    ]
                }),
                new Paragraph({
                    bullet: { level: 0 },
                    children: [
                        new TextRun({ text: "Two-Factor Authentication (2FA): ", bold: true }),
                        new TextRun({ text: "TOTP-based authenticator protection with backup emergency codes for administrators and leaders." })
                    ]
                }),
                new Paragraph({
                    bullet: { level: 0 },
                    children: [
                        new TextRun({ text: "Role-Based Redirection: ", bold: true }),
                        new TextRun({ text: "Upon sign-in, the system automatically opens your designated dashboard (Member, Leader, or Admin)." })
                    ]
                }),

                // Section 3: Member Portal Guide
                new Paragraph({
                    heading: HeadingLevel.HEADING_1,
                    spacing: { before: 300, after: 120 },
                    children: [
                        new TextRun({ text: "3. Member Portal Guide (/member)", font: "Georgia", size: 28, bold: true, color: COLOR_NAVY })
                    ]
                }),
                new Paragraph({
                    children: [
                        new TextRun({ text: "The Member Portal keeps regular attendees and registered church members connected with church life." })
                    ]
                }),
                new Paragraph({
                    bullet: { level: 0 },
                    children: [
                        new TextRun({ text: "Dashboard Overview: ", bold: true, color: COLOR_NAVY }),
                        new TextRun({ text: "Displays active church membership status, pastoral greeting, and Sunday service countdown." })
                    ]
                }),
                new Paragraph({
                    bullet: { level: 0 },
                    children: [
                        new TextRun({ text: "Events & Seminary: ", bold: true, color: COLOR_NAVY }),
                        new TextRun({ text: "Browse and register for upcoming conferences, spiritual retreats, and discipleship modules." })
                    ]
                }),
                new Paragraph({
                    bullet: { level: 0 },
                    children: [
                        new TextRun({ text: "Announcements: ", bold: true, color: COLOR_NAVY }),
                        new TextRun({ text: "Stay updated on priority church bulletins, ministry schedules, and prayer requests." })
                    ]
                }),
                new Paragraph({
                    bullet: { level: 0 },
                    children: [
                        new TextRun({ text: "My Ministry: ", bold: true, color: COLOR_NAVY }),
                        new TextRun({ text: "View your assigned WORDA ministry group (Worship, Outreach, Resource, Discipleship, Administration), duty schedules, and ministry leader contact details." })
                    ]
                }),
                new Paragraph({
                    bullet: { level: 0 },
                    children: [
                        new TextRun({ text: "Profile & Preferences (Top-Right Avatar): ", bold: true, color: COLOR_NAVY }),
                        new TextRun({ text: "Update personal contact details, change password, manage 2FA, and toggle between Light and Dark themes." })
                    ]
                }),

                // Section 4: Church Leader Portal Guide
                new Paragraph({
                    heading: HeadingLevel.HEADING_1,
                    spacing: { before: 300, after: 120 },
                    children: [
                        new TextRun({ text: "4. Church Leader Portal Guide (/leader)", font: "Georgia", size: 28, bold: true, color: COLOR_NAVY })
                    ]
                }),
                new Paragraph({
                    children: [
                        new TextRun({ text: "Designed for pastors, elders, deacons, and ministry heads to coordinate ministry operations." })
                    ]
                }),
                new Paragraph({
                    bullet: { level: 0 },
                    children: [
                        new TextRun({ text: "Dashboard Analytics: ", bold: true, color: COLOR_NAVY }),
                        new TextRun({ text: "Summary metrics on weekly attendance counts, upcoming events, and active ministry members." })
                    ]
                }),
                new Paragraph({
                    bullet: { level: 0 },
                    children: [
                        new TextRun({ text: "Tally Counting (Attendance): ", bold: true, color: COLOR_NAVY }),
                        new TextRun({ text: "Record real-time attendance for Sunday worship services, prayer meetings, and ministry rehearsals categorized by Men, Women, Youth, and Children." })
                    ]
                }),
                new Paragraph({
                    bullet: { level: 0 },
                    children: [
                        new TextRun({ text: "Events & Seminary Coordination: ", bold: true, color: COLOR_NAVY }),
                        new TextRun({ text: "Schedule and manage ministry training seminars, rehearsals, and monitor attendee registrations." })
                    ]
                }),
                new Paragraph({
                    bullet: { level: 0 },
                    children: [
                        new TextRun({ text: "Announcements Publishing: ", bold: true, color: COLOR_NAVY }),
                        new TextRun({ text: "Create and publish church-wide or ministry-specific bulletins." })
                    ]
                }),
                new Paragraph({
                    bullet: { level: 0 },
                    children: [
                        new TextRun({ text: "WORDA Ministries Oversight: ", bold: true, color: COLOR_NAVY }),
                        new TextRun({ text: "Oversee volunteer teams, assign task rosters, and monitor departmental goals." })
                    ]
                }),
                new Paragraph({
                    bullet: { level: 0 },
                    children: [
                        new TextRun({ text: "Content Management: ", bold: true, color: COLOR_NAVY }),
                        new TextRun({ text: "Update livestream status, manage description and sermon outlines using the adjustable 260px workspace, and moderate comments." })
                    ]
                }),
                new Paragraph({
                    bullet: { level: 0 },
                    children: [
                        new TextRun({ text: "Finance (View-Only): ", bold: true, color: COLOR_NAVY }),
                        new TextRun({ text: "Transparent read-only view of ministry collections and budget allocations." })
                    ]
                }),
                new Paragraph({
                    bullet: { level: 0 },
                    children: [
                        new TextRun({ text: "Reports Generation: ", bold: true, color: COLOR_NAVY }),
                        new TextRun({ text: "Export clean attendance logs, tally records, and ministry summaries for pastoral meetings." })
                    ]
                }),

                // Section 5: Super Admin Portal Guide
                new Paragraph({
                    heading: HeadingLevel.HEADING_1,
                    spacing: { before: 300, after: 120 },
                    children: [
                        new TextRun({ text: "5. Super Admin Portal Guide (/admin)", font: "Georgia", size: 28, bold: true, color: COLOR_NAVY })
                    ]
                }),
                new Paragraph({
                    children: [
                        new TextRun({ text: "Complete administrative governance and infrastructure control center." })
                    ]
                }),
                new Paragraph({
                    bullet: { level: 0 },
                    children: [
                        new TextRun({ text: "Account Management & Access Control: ", bold: true, color: COLOR_NAVY }),
                        new TextRun({ text: "Create and manage system user accounts, assign roles (Super Admin, Leader, Member), activate/deactivate accounts, and manage security credentials. Built-in safeguards protect primary admin accounts and force immediate logout when roles change." })
                    ]
                }),
                new Paragraph({
                    bullet: { level: 0 },
                    children: [
                        new TextRun({ text: "Member Records Master Directory: ", bold: true, color: COLOR_NAVY }),
                        new TextRun({ text: "Maintain complete church profiles including spiritual milestones, water baptism dates, emergency contacts, and family linkage." })
                    ]
                }),
                new Paragraph({
                    bullet: { level: 0 },
                    children: [
                        new TextRun({ text: "WORDA Departmental Structure: ", bold: true, color: COLOR_NAVY }),
                        new TextRun({ text: "Configure church governance across Worship, Outreach, Resource, Discipleship, and Administration." })
                    ]
                }),
                new Paragraph({
                    bullet: { level: 0 },
                    children: [
                        new TextRun({ text: "Financial Management & Tithes: ", bold: true, color: COLOR_NAVY }),
                        new TextRun({ text: "Record tithes, general offerings, missions funds, and love gifts. View monthly breakdown charts and export formal financial statements." })
                    ]
                }),
                new Paragraph({
                    bullet: { level: 0 },
                    children: [
                        new TextRun({ text: "Content Management System (CMS): ", bold: true, color: COLOR_NAVY }),
                        new TextRun({ text: "Edit homepage headline and scripture verses, upload high-definition hero background media up to 100 MB, manage livestream status, update sermon notes, and publish announcement banners." })
                    ]
                }),
                new Paragraph({
                    bullet: { level: 0 },
                    children: [
                        new TextRun({ text: "System Settings & Infrastructure: ", bold: true, color: COLOR_NAVY }),
                        new TextRun({ text: "One-click backup download of all 33 database tables in secure JSON format, Official Google Gmail REST API dispatcher monitoring (HTTPS Port 443), and real-time security audit trails." })
                    ]
                }),

                // Section 6: Maintenance & Semaphore Status
                new Paragraph({
                    heading: HeadingLevel.HEADING_1,
                    spacing: { before: 300, after: 120 },
                    children: [
                        new TextRun({ text: "6. System Maintenance & Semaphore Status", font: "Georgia", size: 28, bold: true, color: COLOR_NAVY })
                    ]
                }),
                new Paragraph({
                    children: [
                        new TextRun({ text: "Status Overview for Church Administration: ", bold: true }),
                        new TextRun({ text: "The church portal operates a dual notification architecture (Email + SMS):" })
                    ]
                }),
                new Paragraph({
                    bullet: { level: 0 },
                    children: [
                        new TextRun({ text: "Email Dispatcher (ACTIVE): ", bold: true, color: "15803D" }),
                        new TextRun({ text: "Delivering member verifications, password resets, and announcements via the Official Google Gmail REST API over HTTPS port 443 without domain barriers." })
                    ]
                }),
                new Paragraph({
                    bullet: { level: 0 },
                    children: [
                        new TextRun({ text: "SMS Gateway (PENDING TELCO APPROVAL): ", bold: true, color: COLOR_ALERT_TEXT }),
                        new TextRun({ text: "Our custom alphanumeric Sender ID " }),
                        new TextRun({ text: "COGIMUS", bold: true }),
                        new TextRun({ text: " is currently undergoing compliance registration with Philippine carriers (Globe, Smart, DITO) via Semaphore. All SMS requests are securely logged in the database and will resume cellular transmission once approved." })
                    ]
                }),
                new Paragraph({
                    spacing: { before: 300, after: 0 },
                    alignment: AlignmentType.CENTER,
                    children: [
                        new TextRun({
                            text: "— End of Guide — Church of God World Missions Philippines - Imus",
                            italics: true,
                            size: 18,
                            color: COLOR_MUTED
                        })
                    ]
                })
            ]
        }]
    });

    const buffer = await Packer.toBuffer(doc);
    
    // Save to workspace root
    const rootPath = path.join(__dirname, '../COG_Imus_Portal_Navigation_Guide.docx');
    fs.writeFileSync(rootPath, buffer);
    console.log('Saved Word document to root:', rootPath);

    // Save copy to artifact directory
    const artifactDir = 'C:\\Users\\User\\.gemini\\antigravity\\brain\\e28b49d9-e6d3-4138-b3c6-f49ff624b9c0';
    if (fs.existsSync(artifactDir)) {
        const artifactPath = path.join(artifactDir, 'COG_Imus_Portal_Navigation_Guide.docx');
        fs.writeFileSync(artifactPath, buffer);
        console.log('Saved Word document to artifact dir:', artifactPath);
    }
}

createGuideDocx().catch(err => {
    console.error('Error generating docx:', err);
    process.exit(1);
});
