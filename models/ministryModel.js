const { pool } = require('../config/database');

let _departmentHeadsTableEnsured = false;

const MinistryModel = {
    async getAll(limit = null, offset = 0, filters = {}) {
        const { whereClause, params } = this.buildWhere(filters);
        let sql = `SELECT m.*, 
                           CONCAT(leader.first_name, ' ', leader.last_name) AS leader_name,
                           u.profile_image AS leader_profile_image,
                           (SELECT COUNT(*) FROM ministry_members WHERE ministry_id = m.ministry_id AND status = 'Active') AS member_count
                    FROM ministries m
                    LEFT JOIN members leader ON m.leader_member_id = leader.member_id
                    LEFT JOIN users u ON leader.user_id = u.user_id
                    ${whereClause}
                    ORDER BY m.ministry_name ASC`;
        if (limit !== null && limit !== undefined) {
            sql += ` LIMIT ${parseInt(limit, 10)} OFFSET ${parseInt(offset, 10)}`;
        }
        const [rows] = await pool.query(sql, params);
        return rows;
    },

    buildWhere(filters = {}) {
        const conditions = [];
        const params = [];

        if (filters.search && String(filters.search).trim()) {
            const q = `%${String(filters.search).trim()}%`;
            conditions.push(`(m.ministry_name LIKE ? OR m.ministry_code LIKE ? OR m.description LIKE ? OR leader.first_name LIKE ? OR leader.last_name LIKE ?)`);
            params.push(q, q, q, q, q);
        }
        if (filters.department && String(filters.department).trim()) {
            conditions.push(`m.department = ?`);
            params.push(String(filters.department).trim());
        }
        if (filters.status !== undefined && filters.status !== '') {
            const s = String(filters.status).trim();
            conditions.push(`m.is_active = ?`);
            params.push(s === 'Active' || s === '1' ? 1 : 0);
        }

        const whereClause = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';
        return { whereClause, params };
    },

    async getCount(filters = {}) {
        const { whereClause, params } = this.buildWhere(filters);
        const sql = `SELECT COUNT(*) AS total 
                     FROM ministries m
                     LEFT JOIN members leader ON m.leader_member_id = leader.member_id
                     ${whereClause}`;
        const [rows] = await pool.query(sql, params);
        return rows[0] ? rows[0].total : 0;
    },

    async getById(id) {
        const [rows] = await pool.execute(
            `SELECT * FROM ministries WHERE ministry_id = ?`,
            [id]
        );
        return rows[0];
    },

    async create(data) {
        const { ministry_name, ministry_code, department, description, leader_member_id, meeting_schedule, color_code } = data;
        const [result] = await pool.execute(
            `INSERT INTO ministries (ministry_name, ministry_code, department, description, leader_member_id, meeting_schedule, color_code) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [ministry_name, ministry_code || null, department || 'Worship', description || null, leader_member_id || null, meeting_schedule || null, color_code || '#3b82f6']
        );
        return result.insertId;
    },

    async update(id, data) {
        const { ministry_name, ministry_code, department, description, leader_member_id, meeting_schedule, color_code, is_active } = data;
        const activeVal = (is_active === 1 || is_active === '1' || is_active === true || is_active === 'true') ? 1 : 0;
        await pool.execute(
            `UPDATE ministries SET 
                ministry_name = ?, ministry_code = ?, department = ?, description = ?, leader_member_id = ?, 
                meeting_schedule = ?, color_code = ?, is_active = ? 
             WHERE ministry_id = ?`,
            [ministry_name, ministry_code || null, department || 'Worship', description || null, leader_member_id || null, meeting_schedule || null, color_code || '#3b82f6', activeVal, id]
        );
        if (leader_member_id) {
            await pool.execute(
                `INSERT INTO ministry_members (ministry_id, member_id, role_in_ministry, joined_date, status)
                 VALUES (?, ?, 'Ministry Leader', CURDATE(), 'Active')
                 ON DUPLICATE KEY UPDATE status = 'Active', role_in_ministry = IF(role_in_ministry IS NULL OR role_in_ministry = '' OR role_in_ministry = 'Member', 'Ministry Leader', role_in_ministry)`,
                [id, leader_member_id]
            );
        }
    },

    async delete(id) {
        await pool.execute(`DELETE FROM ministries WHERE ministry_id = ?`, [id]);
    },

    // --- Ministry Members ---
    async getMinistryMembers(ministryId) {
        // Automatically sync the designated ministry leader into ministry_members if missing
        try {
            const [minRows] = await pool.execute(
                `SELECT leader_member_id FROM ministries WHERE ministry_id = ?`,
                [ministryId]
            );
            const leaderId = minRows[0]?.leader_member_id;
            if (leaderId) {
                await pool.execute(
                    `INSERT INTO ministry_members (ministry_id, member_id, role_in_ministry, joined_date, status)
                     VALUES (?, ?, 'Ministry Leader', CURDATE(), 'Active')
                     ON DUPLICATE KEY UPDATE status = 'Active'`,
                    [ministryId, leaderId]
                );
            }
        } catch (e) {
            console.error('Auto-sync leader in getMinistryMembers error:', e);
        }

        const [rows] = await pool.execute(
            `SELECT mm.ministry_member_id, mm.role_in_ministry, mm.joined_date, mm.status,
                    (CASE WHEN min.leader_member_id = m.member_id THEN 1 ELSE 0 END) AS is_ministry_leader,
                    m.member_id, m.first_name, m.last_name, m.contact_number, m.email,
                    u.profile_image
             FROM ministry_members mm
             JOIN members m ON mm.member_id = m.member_id
             JOIN ministries min ON mm.ministry_id = min.ministry_id
             LEFT JOIN users u ON m.user_id = u.user_id
             WHERE mm.ministry_id = ?
             ORDER BY is_ministry_leader DESC, mm.role_in_ministry DESC, m.last_name ASC`,
            [ministryId]
        );
        return rows;
    },
    
    async getMyMinistries(userId) {
        const [memRows] = await pool.execute(`SELECT member_id FROM members WHERE user_id = ?`, [userId]);
        const memberId = memRows[0]?.member_id;
        if (!memberId) return [];

        const [rows] = await pool.execute(
            `SELECT m.ministry_id, m.ministry_name, m.ministry_code, m.department, m.description, 
                    m.meeting_schedule, m.color_code, m.is_active,
                    mm.ministry_member_id, mm.member_id, mm.role_in_ministry, mm.joined_date, mm.status,
                    CONCAT(leader.first_name, ' ', leader.last_name) AS leader_name,
                    leader_u.profile_image AS leader_profile_image,
                    leader.contact_number AS leader_contact,
                    leader.email AS leader_email,
                    -- Total sessions logged by the leader for this ministry
                    (SELECT COUNT(*) FROM ministry_attendance WHERE ministry_id = m.ministry_id) AS total_logged_sessions,
                    -- Attended count (Present + Late)
                    (SELECT COUNT(*) FROM ministry_attendance_records mar 
                     JOIN ministry_attendance ma ON mar.attendance_id = ma.attendance_id 
                     WHERE ma.ministry_id = m.ministry_id AND mar.member_id = mm.member_id AND mar.status IN ('Present', 'Late')) AS attended_count,
                    -- Present count
                    (SELECT COUNT(*) FROM ministry_attendance_records mar 
                     JOIN ministry_attendance ma ON mar.attendance_id = ma.attendance_id 
                     WHERE ma.ministry_id = m.ministry_id AND mar.member_id = mm.member_id AND mar.status = 'Present') AS present_count,
                    -- Late count
                    (SELECT COUNT(*) FROM ministry_attendance_records mar 
                     JOIN ministry_attendance ma ON mar.attendance_id = ma.attendance_id 
                     WHERE ma.ministry_id = m.ministry_id AND mar.member_id = mm.member_id AND mar.status = 'Late') AS late_count,
                    -- Excused count
                    (SELECT COUNT(*) FROM ministry_attendance_records mar 
                     JOIN ministry_attendance ma ON mar.attendance_id = ma.attendance_id 
                     WHERE ma.ministry_id = m.ministry_id AND mar.member_id = mm.member_id AND mar.status = 'Excused') AS excused_count,
                    -- Absent count
                    (SELECT COUNT(*) FROM ministry_attendance_records mar 
                     JOIN ministry_attendance ma ON mar.attendance_id = ma.attendance_id 
                     WHERE ma.ministry_id = m.ministry_id AND mar.member_id = mm.member_id AND mar.status = 'Absent') AS absent_count,
                    -- Last attended date
                    (SELECT MAX(ma.session_date) FROM ministry_attendance_records mar 
                     JOIN ministry_attendance ma ON mar.attendance_id = ma.attendance_id 
                     WHERE ma.ministry_id = m.ministry_id AND mar.member_id = mm.member_id AND mar.status IN ('Present', 'Late')) AS last_attended_date,
                    -- Attendance percentage rate
                    ROUND(
                        (SELECT COUNT(*) FROM ministry_attendance_records mar 
                         JOIN ministry_attendance ma ON mar.attendance_id = ma.attendance_id 
                         WHERE ma.ministry_id = m.ministry_id AND mar.member_id = mm.member_id AND mar.status IN ('Present', 'Late')) * 100.0 /
                        NULLIF((SELECT COUNT(*) FROM ministry_attendance WHERE ministry_id = m.ministry_id), 0),
                        0
                    ) AS attendance_rate
             FROM ministry_members mm
             JOIN ministries m ON mm.ministry_id = m.ministry_id
             LEFT JOIN members leader ON m.leader_member_id = leader.member_id
             LEFT JOIN users leader_u ON leader.user_id = leader_u.user_id
             WHERE mm.member_id = ? AND mm.status = 'Active'
             ORDER BY mm.role_in_ministry = 'Leader' DESC, m.ministry_name ASC`,
            [memberId]
        );
        return rows;
    },

    async getMyMinistry(userId) {
        const rows = await this.getMyMinistries(userId);
        return rows[0] || null;
    },

    async getMemberMinistryAttendanceHistory(userId, ministryId) {
        const [memRows] = await pool.execute(`SELECT member_id FROM members WHERE user_id = ?`, [userId]);
        const memberId = memRows[0]?.member_id;
        if (!memberId) return [];

        const [rows] = await pool.execute(
            `SELECT ma.attendance_id, ma.session_title, ma.session_date, ma.session_type, ma.notes AS session_notes,
                    mar.record_id, 
                    COALESCE(mar.status, 'Unrecorded') AS status,
                    mar.notes AS member_notes,
                    CONCAT(u.first_name, ' ', u.last_name) AS recorded_by_name,
                    ROUND(
                        (SELECT COUNT(*) FROM ministry_attendance_records sub_mar WHERE sub_mar.attendance_id = ma.attendance_id AND sub_mar.status IN ('Present', 'Late')) * 100.0 /
                        NULLIF((SELECT COUNT(*) FROM ministry_attendance_records sub_mar WHERE sub_mar.attendance_id = ma.attendance_id), 0),
                        0
                    ) AS session_turnout_percentage
             FROM ministry_attendance ma
             LEFT JOIN ministry_attendance_records mar ON ma.attendance_id = mar.attendance_id AND mar.member_id = ?
             LEFT JOIN users u ON ma.recorded_by = u.user_id
             WHERE ma.ministry_id = ?
             ORDER BY ma.session_date DESC, ma.created_at DESC`,
            [memberId, ministryId]
        );
        return rows;
    },

    async addMember(ministryId, memberId, roleInMinistry) {
        const [result] = await pool.execute(
            `INSERT INTO ministry_members (ministry_id, member_id, role_in_ministry, joined_date) 
             VALUES (?, ?, ?, CURDATE())
             ON DUPLICATE KEY UPDATE role_in_ministry = VALUES(role_in_ministry), status = 'Active'`,
            [ministryId, memberId, roleInMinistry || 'Member']
        );
        return result.insertId;
    },

    async removeMember(ministryMemberId) {
        await pool.execute(`DELETE FROM ministry_members WHERE ministry_member_id = ?`, [ministryMemberId]);
    },

    // --- Leader Assigned Ministries ---
    async getAssignedMinistriesForLeader(userId) {
        const [memRows] = await pool.execute(`SELECT member_id FROM members WHERE user_id = ?`, [userId]);
        const memberId = memRows[0]?.member_id;

        if (!memberId) {
            return [];
        }

        const [rows] = await pool.execute(
            `SELECT m.*, 
                    CONCAT(leader.first_name, ' ', leader.last_name) AS leader_name,
                    u.profile_image AS leader_profile_image,
                    leader.contact_number AS leader_contact,
                    leader.email AS leader_email,
                    (SELECT COUNT(*) FROM ministry_members WHERE ministry_id = m.ministry_id AND status = 'Active') AS member_count,
                    (SELECT COUNT(*) FROM ministry_attendance WHERE ministry_id = m.ministry_id) AS total_attendance_sessions
             FROM ministries m
             LEFT JOIN members leader ON m.leader_member_id = leader.member_id
             LEFT JOIN users u ON leader.user_id = u.user_id
             WHERE m.leader_member_id = ?
                OR m.ministry_id IN (
                    SELECT mm.ministry_id FROM ministry_members mm 
                    WHERE mm.member_id = ? AND mm.status = 'Active' AND mm.role_in_ministry IN ('Leader', 'Assistant Leader', 'Coordinator')
                )
             ORDER BY m.ministry_name ASC`,
            [memberId, memberId]
        );
        return rows;
    },

    // --- Ministry Roster with Attendance Stats ---
    async getMinistryRosterWithAttendance(ministryId) {
        const [rows] = await pool.execute(
            `SELECT mm.ministry_member_id, mm.role_in_ministry, mm.joined_date, mm.status,
                    m.member_id, m.first_name, m.last_name, m.contact_number, m.email,
                    u.profile_image,
                    COUNT(mar.record_id) AS total_logged_sessions,
                    COUNT(CASE WHEN mar.status = 'Present' THEN 1 END) AS present_count,
                    COUNT(CASE WHEN mar.status = 'Late' THEN 1 END) AS late_count,
                    COUNT(CASE WHEN mar.status = 'Excused' THEN 1 END) AS excused_count,
                    COUNT(CASE WHEN mar.status = 'Absent' THEN 1 END) AS absent_count,
                    COUNT(CASE WHEN mar.status IN ('Present', 'Late') THEN 1 END) AS attended_count,
                    MAX(CASE WHEN mar.status IN ('Present', 'Late') THEN ma.session_date END) AS last_attended_date,
                    ROUND(
                        (COUNT(CASE WHEN mar.status IN ('Present', 'Late') THEN 1 END) * 100.0) / 
                        NULLIF(COUNT(mar.record_id), 0),
                        0
                    ) AS attendance_rate
             FROM ministry_members mm
             JOIN members m ON mm.member_id = m.member_id
             LEFT JOIN users u ON m.user_id = u.user_id
             LEFT JOIN ministry_attendance ma ON ma.ministry_id = mm.ministry_id
             LEFT JOIN ministry_attendance_records mar ON mar.attendance_id = ma.attendance_id AND mar.member_id = mm.member_id
             WHERE mm.ministry_id = ?
             GROUP BY mm.ministry_member_id, m.member_id
             ORDER BY 
                 CASE mm.role_in_ministry 
                     WHEN 'Leader' THEN 1 
                     WHEN 'Assistant Leader' THEN 2 
                     WHEN 'Coordinator' THEN 3 
                     ELSE 4 
                 END ASC, 
                 m.last_name ASC`,
            [ministryId]
        );
        return rows;
    },

    // --- Ministry Attendance Sessions ---
    async getMinistryAttendanceSessions(ministryId) {
        const [rows] = await pool.execute(
            `SELECT ma.*,
                    CONCAT(u.first_name, ' ', u.last_name) AS recorded_by_name,
                    COUNT(mar.record_id) AS total_roster_count,
                    COUNT(CASE WHEN mar.status = 'Present' THEN 1 END) AS present_count,
                    COUNT(CASE WHEN mar.status = 'Late' THEN 1 END) AS late_count,
                    COUNT(CASE WHEN mar.status = 'Excused' THEN 1 END) AS excused_count,
                    COUNT(CASE WHEN mar.status = 'Absent' THEN 1 END) AS absent_count,
                    ROUND(
                        (COUNT(CASE WHEN mar.status IN ('Present', 'Late') THEN 1 END) * 100.0) /
                        NULLIF(COUNT(mar.record_id), 0),
                        0
                    ) AS attendance_percentage
             FROM ministry_attendance ma
             LEFT JOIN users u ON ma.recorded_by = u.user_id
             LEFT JOIN ministry_attendance_records mar ON ma.attendance_id = mar.attendance_id
             WHERE ma.ministry_id = ?
             GROUP BY ma.attendance_id
             ORDER BY ma.session_date DESC, ma.created_at DESC`,
            [ministryId]
        );
        return rows;
    },

    async getAttendanceSessionDetails(attendanceId) {
        const [sessionRows] = await pool.execute(
            `SELECT ma.*, 
                    m.ministry_name, m.department, m.color_code,
                    CONCAT(u.first_name, ' ', u.last_name) AS recorded_by_name
             FROM ministry_attendance ma
             JOIN ministries m ON ma.ministry_id = m.ministry_id
             LEFT JOIN users u ON ma.recorded_by = u.user_id
             WHERE ma.attendance_id = ?`,
            [attendanceId]
        );

        if (!sessionRows[0]) return null;

        const [records] = await pool.execute(
            `SELECT mar.record_id, mar.status, mar.notes,
                    m.member_id, m.first_name, m.last_name, m.contact_number, m.email,
                    mm.role_in_ministry, u.profile_image
             FROM ministry_attendance_records mar
             JOIN members m ON mar.member_id = m.member_id
             LEFT JOIN users u ON m.user_id = u.user_id
             LEFT JOIN ministry_attendance ma ON mar.attendance_id = ma.attendance_id
             LEFT JOIN ministry_members mm ON mm.ministry_id = ma.ministry_id AND mm.member_id = m.member_id
             WHERE mar.attendance_id = ?
             ORDER BY 
                 CASE mm.role_in_ministry WHEN 'Leader' THEN 1 WHEN 'Assistant Leader' THEN 2 ELSE 3 END ASC,
                 m.last_name ASC`,
            [attendanceId]
        );

        return {
            session: sessionRows[0],
            records
        };
    },

    async recordAttendanceSession(ministryId, recordedByUserId, data) {
        const { session_title, session_date, session_type, notes, records } = data;
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            const [result] = await connection.execute(
                `INSERT INTO ministry_attendance (ministry_id, session_title, session_date, session_type, recorded_by, notes)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [ministryId, session_title, session_date, session_type || 'Meeting', recordedByUserId, notes || null]
            );

            const attendanceId = result.insertId;

            if (records && Array.isArray(records) && records.length > 0) {
                for (const r of records) {
                    if (r.member_id) {
                        await connection.execute(
                            `INSERT INTO ministry_attendance_records (attendance_id, member_id, status, notes)
                             VALUES (?, ?, ?, ?)
                             ON DUPLICATE KEY UPDATE status = VALUES(status), notes = VALUES(notes)`,
                            [attendanceId, r.member_id, r.status || 'Present', r.notes || null]
                        );
                    }
                }
            }

            await connection.commit();
            return attendanceId;
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    },

    async updateAttendanceSession(attendanceId, data) {
        const { session_title, session_date, session_type, notes, records } = data;
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            await connection.execute(
                `UPDATE ministry_attendance SET 
                    session_title = ?, session_date = ?, session_type = ?, notes = ?
                 WHERE attendance_id = ?`,
                [session_title, session_date, session_type || 'Meeting', notes || null, attendanceId]
            );

            if (records && Array.isArray(records)) {
                for (const r of records) {
                    if (r.member_id) {
                        await connection.execute(
                            `INSERT INTO ministry_attendance_records (attendance_id, member_id, status, notes)
                             VALUES (?, ?, ?, ?)
                             ON DUPLICATE KEY UPDATE status = VALUES(status), notes = VALUES(notes)`,
                            [attendanceId, r.member_id, r.status || 'Present', r.notes || null]
                        );
                    }
                }
            }

            await connection.commit();
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    },

    async deleteAttendanceSession(attendanceId) {
        await pool.execute(`DELETE FROM ministry_attendance WHERE attendance_id = ?`, [attendanceId]);
    },

    async getMemberAttendanceHistory(ministryId, memberId) {
        const [rows] = await pool.execute(
            `SELECT ma.attendance_id, ma.session_title, ma.session_date, ma.session_type,
                    COALESCE(mar.status, 'Unrecorded') AS status, 
                    mar.notes AS member_notes
             FROM ministry_attendance ma
             LEFT JOIN ministry_attendance_records mar ON ma.attendance_id = mar.attendance_id AND mar.member_id = ?
             WHERE ma.ministry_id = ?
             ORDER BY ma.session_date DESC`,
            [memberId, ministryId]
        );
        return rows;
    }
,

    async ensureDepartmentHeadsTable() {
        if (_departmentHeadsTableEnsured) return;
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS department_heads (
                department_head_id INT AUTO_INCREMENT PRIMARY KEY,
                department ENUM('Worship', 'Outreach', 'Relationship', 'Discipleship', 'Administration') NOT NULL UNIQUE,
                head_member_id INT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (head_member_id) REFERENCES members(member_id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        const depts = ['Worship', 'Outreach', 'Relationship', 'Discipleship', 'Administration'];
        for (const d of depts) {
            await pool.execute(
                `INSERT INTO department_heads (department, head_member_id) 
                 VALUES (?, NULL) 
                 ON DUPLICATE KEY UPDATE department = department`,
                [d]
            );
        }
        _departmentHeadsTableEnsured = true;
    },

    async getDepartmentHeads() {
        await this.ensureDepartmentHeadsTable();
        const [rows] = await pool.execute(`
            SELECT dh.department, dh.head_member_id, dh.updated_at,
                   CONCAT(m.first_name, ' ', COALESCE(CONCAT(m.middle_name, ' '), ''), m.last_name, COALESCE(CONCAT(' ', m.suffix), '')) AS head_name,
                   m.first_name, m.last_name, m.church_role, m.email, m.contact_number,
                   u.username, u.profile_image AS head_profile_image
            FROM department_heads dh
            LEFT JOIN members m ON dh.head_member_id = m.member_id
            LEFT JOIN users u ON m.user_id = u.user_id
            ORDER BY FIELD(dh.department, 'Worship', 'Outreach', 'Relationship', 'Discipleship', 'Administration')
        `);
        return rows;
    },

    async getDepartmentHead(department) {
        await this.ensureDepartmentHeadsTable();
        const [rows] = await pool.execute(`
            SELECT dh.department, dh.head_member_id, dh.updated_at,
                   CONCAT(m.first_name, ' ', COALESCE(CONCAT(m.middle_name, ' '), ''), m.last_name, COALESCE(CONCAT(' ', m.suffix), '')) AS head_name,
                   m.first_name, m.last_name, m.church_role, m.email, m.contact_number,
                   u.username, u.profile_image AS head_profile_image
            FROM department_heads dh
            LEFT JOIN members m ON dh.head_member_id = m.member_id
            LEFT JOIN users u ON m.user_id = u.user_id
            WHERE dh.department = ?
            LIMIT 1
        `, [department]);
        return rows[0] || null;
    },

    async updateDepartmentHead(department, headMemberId) {
        await this.ensureDepartmentHeadsTable();
        if (headMemberId) {
            const [memRows] = await pool.execute(`
                SELECT m.member_id, m.first_name, m.last_name, m.church_role, m.status, r.role_name
                FROM members m
                LEFT JOIN users u ON m.user_id = u.user_id
                LEFT JOIN roles r ON u.role_id = r.role_id
                WHERE m.member_id = ?
                LIMIT 1
            `, [headMemberId]);

            if (memRows.length === 0) {
                throw new Error('Selected member not found.');
            }

            const mem = memRows[0];
            const isEligible = mem.church_role === 'Leader' || mem.church_role === 'Admin' ||
                               mem.role_name === 'Church Leader' || mem.role_name === 'Admin';
            if (!isEligible) {
                throw new Error('Only Church Leaders and Church Admins can be assigned as Department Head.');
            }
        }

        await pool.execute(`
            INSERT INTO department_heads (department, head_member_id)
            VALUES (?, ?)
            ON DUPLICATE KEY UPDATE head_member_id = VALUES(head_member_id)
        `, [department, headMemberId || null]);

        return await this.getDepartmentHead(department);
    }
,

    async getLeaderDepartmentOversight(userId) {
        await this.ensureDepartmentHeadsTable();
        const [memRows] = await pool.execute('SELECT member_id, first_name, last_name, church_role FROM members WHERE user_id = ?', [userId]);
        const memberId = memRows[0]?.member_id;

        if (!memberId) {
            return { is_department_head: false, departments: [] };
        }

        const [dhRows] = await pool.execute(
            `SELECT dh.department, dh.updated_at 
             FROM department_heads dh 
             WHERE dh.head_member_id = ? 
             ORDER BY FIELD(dh.department, 'Worship', 'Outreach', 'Relationship', 'Discipleship', 'Administration')`,
            [memberId]
        );

        if (dhRows.length === 0) {
            return { is_department_head: false, departments: [] };
        }

        const departments = [];
        for (const dh of dhRows) {
            const dept = dh.department;
            const [ministries] = await pool.execute(
                `SELECT m.*, 
                        CONCAT(leader.first_name, ' ', leader.last_name) AS leader_name,
                        u.profile_image AS leader_profile_image,
                        leader.contact_number AS leader_contact,
                        leader.email AS leader_email,
                        (SELECT COUNT(*) FROM ministry_members WHERE ministry_id = m.ministry_id AND status = 'Active') AS member_count,
                        (SELECT COUNT(*) FROM ministry_attendance WHERE ministry_id = m.ministry_id) AS total_attendance_sessions
                 FROM ministries m
                 LEFT JOIN members leader ON m.leader_member_id = leader.member_id
                 LEFT JOIN users u ON leader.user_id = u.user_id
                 WHERE m.department = ?
                 ORDER BY m.ministry_name ASC`,
                [dept]
            );

            // Calculate statistics
            const minIds = ministries.map(m => m.ministry_id);
            let activeMembersCount = 0;
            let leadersCount = 0;

            if (minIds.length > 0) {
                const placeholders = minIds.map(() => '?').join(',');
                const [countRes] = await pool.query(
                    `SELECT COUNT(DISTINCT member_id) AS total_active_members 
                     FROM ministry_members 
                     WHERE ministry_id IN (${placeholders}) AND status = 'Active'`,
                    minIds
                );
                activeMembersCount = countRes[0]?.total_active_members || 0;

                const distinctLeaders = new Set(ministries.map(m => m.leader_member_id).filter(Boolean));
                leadersCount = distinctLeaders.size;
            }

            departments.push({
                department: dept,
                stats: {
                    total_ministries: ministries.length,
                    total_active_members: activeMembersCount,
                    total_leaders: leadersCount,
                    c2s_applicable: dept.toLowerCase() === 'relationship'
                },
                ministries: ministries
            });
        }

        return {
            is_department_head: true,
            member_id: memberId,
            departments: departments
        };
    }

};

module.exports = MinistryModel;