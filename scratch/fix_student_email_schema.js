const supabase = require('../database/db');

async function fixStudentSchema() {
    try {
        console.log('Testing inserting student with fallback email...');
        const testRoll = 'TEST_' + Date.now();
        const fallbackEmail = `${testRoll.toLowerCase()}@student.local`;
        
        const { data, error } = await supabase.from('students').insert({
            roll_number: testRoll,
            full_name: 'Test Student No Email',
            email: fallbackEmail,
            phone: null,
            enrollment_year: 2026,
            status: 'active'
        }).select();

        if (error) {
            console.error('Error inserting:', error);
        } else {
            console.log('Successfully inserted student!', data);
            // Clean test student
            await supabase.from('students').delete().eq('roll_number', testRoll);
            console.log('Test student cleaned up successfully.');
        }
    } catch (e) {
        console.error(e);
    }
}

fixStudentSchema();
