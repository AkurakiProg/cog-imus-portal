const { pool } = require('../config/database');

const c2sModel = {
    /**
     * Get all C2S cell groups with summary metrics
     */
    async getAll(limit = null, offset = 0, filters = {}) {
        if (typeof limit === 'object' && limit !== null) {
            filters = limit;
            limit = null;
            offset = 0;
        }
        let query = `
            SELECT 
                g.group_id,
                g.group_name,
                g.leader_id,
                CONCAT(m.first_name, ' ', COALESCE(CONCAT(m.middle_name, ' '), ''), m.last_name) AS leader_name,
                m.contact_number AS leader_contact,
                m.email AS leader_email,
                u.profile_image AS leader_profile_image,
                g.meeting_day,
                g.meeting_time,
                g.meeting_location,
                g.description,
                g.status,
                g.created_at,
                g.updated_at,
                1 AS primary_mentor_count,
                (
                    SELECT COUNT(*)
                    FROM c2s_group_members cgm
                    WHERE cgm.group_id = g.group_id
                      AND cgm.member_id NOT IN (
                          SELECT DISTINCT leader_id FROM c2s_groups WHERE status = 'Active'
                      )
                ) AS mentees_count,
                (
                    SELECT COUNT(*)
                    FROM c2s_group_members cgm
                    WHERE cgm.group_id = g.group_id
                      AND cgm.member_id IN (
                          SELECT DISTINCT leader_id FROM c2s_groups WHERE status = 'Active'
                      )
                ) AS secondary_mentors_count,
                (
                    1 + (SELECT COUNT(*) FROM c2s_group_members WHERE group_id = g.group_id)
                ) AS total_members_count,
                (
                    1 + (SELECT COUNT(*) FROM c2s_group_members WHERE group_id = g.group_id)
                ) AS total_size
            FROM c2s_groups g
            LEFT JOIN members m ON g.leader_id = m.member_id
            LEFT JOIN users u ON m.user_id = u.user_id
            WHERE 1=1
        `;

        const params = [];

        if (filters.status && filters.status !== 'All') {
            query += ' AND g.status = ?';
            params.push(filters.status);
        }

        if (filters.meeting_day && filters.meeting_day !== 'All') {
            query += ' AND g.meeting_day = ?';
            params.push(filters.meeting_day);
        }

        if (filters.search) {
            query += ' AND (g.group_name LIKE ? OR m.first_name LIKE ? OR m.last_name LIKE ? OR g.meeting_location LIKE ?)';
            const searchParam = `%${filters.search}%`;
            params.push(searchParam, searchParam, searchParam, searchParam);
        }

        query += ' ORDER BY g.group_name ASC';

        if (limit !== null && limit !== undefined) {
            query += ` LIMIT ${parseInt(limit, 10)} OFFSET ${parseInt(offset, 10)}`;
        }

        const [rows] = await pool.query(query, params);
        return rows;
    },

    async getCount(filters = {}) {
        let query = `
            SELECT COUNT(*) AS total
            FROM c2s_groups g
            LEFT JOIN members m ON g.leader_id = m.member_id
            WHERE 1=1
        `;
        const params = [];

        if (filters.status && filters.status !== 'All') {
            query += ' AND g.status = ?';
            params.push(filters.status);
        }

        if (filters.meeting_day && filters.meeting_day !== 'All') {
            query += ' AND g.meeting_day = ?';
            params.push(filters.meeting_day);
        }

        if (filters.search) {
            query += ' AND (g.group_name LIKE ? OR m.first_name LIKE ? OR m.last_name LIKE ? OR g.meeting_location LIKE ?)';
            const searchParam = `%${filters.search}%`;
            params.push(searchParam, searchParam, searchParam, searchParam);
        }

        const [rows] = await pool.query(query, params);
        return rows[0] ? rows[0].total : 0;
    },

    /**
     * Get a single C2S group by ID including its full member roster and designations
     */
    async getById(id) {
        const [groups] = await pool.execute(
            `SELECT 
                g.group_id,
                g.group_name,
                g.leader_id,
                CONCAT(m.first_name, ' ', COALESCE(CONCAT(m.middle_name, ' '), ''), m.last_name) AS leader_name,
                m.contact_number AS leader_contact,
                m.email AS leader_email,
                m.church_role AS leader_church_role,
                u.profile_image AS leader_profile_image,
                g.meeting_day,
                g.meeting_time,
                g.meeting_location,
                g.description,
                g.status,
                g.created_at,
                g.updated_at
             FROM c2s_groups g
             LEFT JOIN members m ON g.leader_id = m.member_id
             LEFT JOIN users u ON m.user_id = u.user_id
             WHERE g.group_id = ?`,
            [id]
        );

        if (groups.length === 0) return null;
        const group = groups[0];

        // Fetch all group members with their designations
        const [members] = await pool.execute(
            `SELECT 
                cgm.id AS c2s_member_record_id,
                cgm.group_id,
                cgm.member_id,
                cgm.notes,
                cgm.joined_date,
                cgm.created_at,
                CONCAT(m.first_name, ' ', COALESCE(CONCAT(m.middle_name, ' '), ''), m.last_name) AS member_name,
                m.first_name,
                m.last_name,
                m.email,
                m.contact_number,
                m.church_role,
                m.status AS member_status,
                u.profile_image,
                (
                    SELECT g2.group_name 
                    FROM c2s_groups g2 
                    WHERE g2.leader_id = cgm.member_id AND g2.status = 'Active' 
                    LIMIT 1
                ) AS leads_group_name
             FROM c2s_group_members cgm
             JOIN members m ON cgm.member_id = m.member_id
             LEFT JOIN users u ON m.user_id = u.user_id
             WHERE cgm.group_id = ?
             ORDER BY m.first_name ASC, m.last_name ASC`,
            [id]
        );

        // Classify each member
        let secondaryMentorsCount = 0;
        let menteesCount = 0;

        const classifiedMembers = members.map(m => {
            const fullName = m.member_name || `${m.first_name} ${m.last_name}`.trim();
            const leadsGroup = !!m.leads_group_name;
            if (leadsGroup) {
                secondaryMentorsCount++;
                return {
                    ...m,
                    full_name: fullName,
                    designation: 'Secondary Mentor',
                    system_designation: 'Mentor',
                    designation_desc: `Leads "${m.leads_group_name}" elsewhere`
                };
            } else {
                menteesCount++;
                return {
                    ...m,
                    full_name: fullName,
                    designation: 'Mentee',
                    system_designation: 'Mentee',
                    designation_desc: 'Mentee in this cell group'
                };
            }
        });

        group.members = classifiedMembers;
        group.primary_mentor_count = 1;
        group.secondary_mentors_count = secondaryMentorsCount;
        group.mentees_count = menteesCount;
        group.total_members_count = 1 + classifiedMembers.length;
        group.total_size = 1 + classifiedMembers.length;

        return group;
    },

    /**
     * Create a new C2S group
     */
    async create(data) {
        const {
            group_name,
            leader_id,
            meeting_day = 'Wednesday',
            meeting_time = '7:00 PM',
            meeting_location = 'Main Church Hall',
            description = '',
            status = 'Active'
        } = data;

        const [result] = await pool.execute(
            `INSERT INTO c2s_groups (group_name, leader_id, meeting_day, meeting_time, meeting_location, description, status)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [group_name, leader_id, meeting_day, meeting_time, meeting_location, description, status]
        );

        return result.insertId;
    },

    /**
     * Update an existing C2S group
     */
    async update(id, data) {
        const {
            group_name,
            leader_id,
            meeting_day,
            meeting_time,
            meeting_location,
            description,
            status
        } = data;

        await pool.execute(
            `UPDATE c2s_groups 
             SET group_name = ?, leader_id = ?, meeting_day = ?, meeting_time = ?, meeting_location = ?, description = ?, status = ?
             WHERE group_id = ?`,
            [group_name, leader_id, meeting_day, meeting_time, meeting_location, description, status, id]
        );

        return true;
    },

    /**
     * Delete a C2S group and its member relations
     */
    async delete(id) {
        await pool.execute(`DELETE FROM c2s_group_members WHERE group_id = ?`, [id]);
        await pool.execute(`DELETE FROM c2s_groups WHERE group_id = ?`, [id]);
        return true;
    },

    /**
     * Add a church member to a C2S group
     */
    async addMember(groupId, data) {
        const { member_id, notes = '', joined_date = new Date().toISOString().split('T')[0] } = data;

        // Check if member is the group leader
        const [group] = await pool.execute(`SELECT leader_id FROM c2s_groups WHERE group_id = ?`, [groupId]);
        if (group.length > 0 && group[0].leader_id == member_id) {
            throw new Error('This member is already the Primary Mentor (Leader) of this group.');
        }

        // Check if already in this group
        const [exists] = await pool.execute(
            `SELECT id FROM c2s_group_members WHERE group_id = ? AND member_id = ?`,
            [groupId, member_id]
        );
        if (exists.length > 0) {
            throw new Error('This member is already part of this cell group.');
        }

        const [result] = await pool.execute(
            `INSERT INTO c2s_group_members (group_id, member_id, notes, joined_date)
             VALUES (?, ?, ?, ?)`,
            [groupId, member_id, notes, joined_date]
        );

        return result.insertId;
    },

    /**
     * Remove a member from a C2S group
     */
    async removeMember(groupId, memberId) {
        await pool.execute(
            `DELETE FROM c2s_group_members WHERE group_id = ? AND member_id = ?`,
            [groupId, memberId]
        );
        return true;
    },

    /**
     * Get all active church members with their system-wide C2S designation
     */
    async getAvailableMembers(excludeGroupId = null) {
        let query = `
            SELECT 
                m.member_id,
                CONCAT(m.first_name, ' ', COALESCE(CONCAT(m.middle_name, ' '), ''), m.last_name) AS full_name,
                m.first_name,
                m.last_name,
                m.email,
                m.contact_number,
                m.church_role,
                m.status,
                m.birth_date,
                m.gender,
                m.civil_status,
                u.profile_image,
                CASE 
                    WHEN EXISTS (SELECT 1 FROM c2s_groups g WHERE g.leader_id = m.member_id AND g.status = 'Active') THEN 'Mentor'
                    WHEN EXISTS (SELECT 1 FROM c2s_group_members cgm WHERE cgm.member_id = m.member_id) THEN 'Mentee'
                    ELSE 'Unassigned'
                END AS system_designation,
                (
                    SELECT g.group_name 
                    FROM c2s_groups g 
                    WHERE g.leader_id = m.member_id AND g.status = 'Active' 
                    LIMIT 1
                ) AS led_group_name,
                (
                    SELECT GROUP_CONCAT(DISTINCT min.ministry_name ORDER BY min.ministry_name SEPARATOR ', ')
                    FROM ministry_members mm
                    JOIN ministries min ON mm.ministry_id = min.ministry_id
                    WHERE mm.member_id = m.member_id 
                      AND mm.status = 'Active' 
                      AND min.is_active = 1
                      AND UPPER(TRIM(min.department)) = 'RELATIONSHIP'
                ) AS relationship_ministries
            FROM members m
            LEFT JOIN users u ON m.user_id = u.user_id
            WHERE m.status = 'Active'
              AND (
                  EXISTS (
                      SELECT 1 
                      FROM ministry_members mm
                      JOIN ministries min ON mm.ministry_id = min.ministry_id
                      WHERE mm.member_id = m.member_id 
                        AND mm.status = 'Active'
                        AND min.is_active = 1
                        AND UPPER(TRIM(min.department)) = 'RELATIONSHIP'
                  )
                  OR EXISTS (
                      SELECT 1
                      FROM ministries min2
                      WHERE min2.leader_member_id = m.member_id
                        AND min2.is_active = 1
                        AND UPPER(TRIM(min2.department)) = 'RELATIONSHIP'
                  )
              )
        `;

        const params = [];
        if (excludeGroupId) {
            query += ` AND m.member_id NOT IN (
                SELECT member_id FROM c2s_group_members WHERE group_id = ?
            )`;
            query += ` AND m.member_id != (
                SELECT COALESCE(leader_id, 0) FROM c2s_groups WHERE group_id = ?
            )`;
            params.push(excludeGroupId, excludeGroupId);
        }

        query += ` ORDER BY m.first_name ASC, m.last_name ASC`;

        const [rows] = await pool.query(query, params);
        return rows;
    },

    /**
     * Quick create a new church member and optionally assign to a C2S group
     */
    async quickCreateMember(data, groupId = null) {
        const {
            first_name,
            last_name,
            middle_name = '',
            email = '',
            contact_number = '',
            gender = 'Other',
            church_role = 'Member',
            notes = ''
        } = data;

        if (!first_name || !last_name) {
            throw new Error('First name and Last name are required.');
        }

        const [result] = await pool.execute(
            `INSERT INTO members (first_name, middle_name, last_name, email, contact_number, gender, church_role, status, membership_date)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'Active', CURDATE())`,
            [first_name, middle_name, last_name, email, contact_number, gender, church_role]
        );

        const newMemberId = result.insertId;

        if (groupId) {
            await pool.execute(
                `INSERT INTO c2s_group_members (group_id, member_id, notes, joined_date)
                 VALUES (?, ?, ?, CURDATE())`,
                [groupId, newMemberId, notes || 'Newly added member']
            );
        }

        return { member_id: newMemberId, full_name: `${first_name} ${last_name}` };
    }
};

module.exports = c2sModel;
