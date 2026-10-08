const supabase = require('../database/db');

async function seedCleanDepartments() {
    try {
        console.log('Clearing old departments and seeding Arts, Commerce, Science...');

        // 1. Unlink students and faculty from old departments to avoid FK constraint errors
        await supabase.from('students').update({ department_id: null }).gte('id', 0);
        await supabase.from('faculty').update({ department_id: null }).gte('id', 0);
        await supabase.from('courses').delete().gte('id', 0);

        // 2. Delete all existing departments
        const { error: delErr } = await supabase.from('departments').delete().gte('id', 0);
        if (delErr) console.error('Delete depts error:', delErr);

        // 3. Insert Arts, Commerce, Science
        const newDepts = [
            { code: 'ART', name: 'Arts', description: 'Faculty of Arts' },
            { code: 'COM', name: 'Commerce', description: 'Faculty of Commerce' },
            { code: 'SCI', name: 'Science', description: 'Faculty of Science' }
        ];

        const { data: inserted, error: insErr } = await supabase.from('departments').insert(newDepts).select('*');
        if (insErr) {
            console.error('Insert depts error:', insErr);
        } else {
            console.log('Successfully inserted new departments:', inserted);
        }

        // 4. Verify final departments list
        const { data: finalDepts } = await supabase.from('departments').select('*').order('name');
        console.log('Final departments in database:', finalDepts);
    } catch (e) {
        console.error(e);
    }
}

seedCleanDepartments();
