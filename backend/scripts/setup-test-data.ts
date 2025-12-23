// Quick setup script to create test data
// Run with: npx tsx scripts/setup-test-data.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Get Clerk user ID from command line or use placeholder
    const clerkUserId = process.argv[2];

    if (!clerkUserId) {
        console.log('Usage: npx tsx scripts/setup-test-data.ts <clerk-user-id>');
        console.log('\nTo find your Clerk user ID:');
        console.log('1. Go to https://dashboard.clerk.com');
        console.log('2. Click on Users');
        console.log('3. Find your user and copy the user_xxx ID');
        process.exit(1);
    }

    console.log('Setting up test data...\n');

    // Create organization
    let org = await prisma.organization.findFirst();
    if (!org) {
        org = await prisma.organization.create({
            data: {
                name: 'Diet Karo Clinic',
                email: 'admin@dietkaro.com',
                isActive: true,
            },
        });
        console.log('✓ Created organization:', org.name);
    } else {
        console.log('✓ Organization exists:', org.name);
    }

    // Create or update user
    let user = await prisma.user.findUnique({ where: { clerkUserId } });
    if (!user) {
        user = await prisma.user.create({
            data: {
                clerkUserId,
                email: 'dietitian@dietkaro.com',
                fullName: 'Test Dietitian',
                role: 'owner',
                orgId: org.id,
                isActive: true,
            },
        });
        console.log('✓ Created user:', user.fullName, `(${user.role})`);
    } else {
        console.log('✓ User exists:', user.fullName);
    }

    // Create sample client
    let client = await prisma.client.findFirst({ where: { orgId: org.id } });
    if (!client) {
        client = await prisma.client.create({
            data: {
                orgId: org.id,
                fullName: 'Priya Sharma',
                email: 'priya@example.com',
                phone: '+91 98765 43210',
                gender: 'female',
                heightCm: 165,
                currentWeightKg: 65,
                targetWeightKg: 58,
                primaryDietitianId: user.id,
                createdByUserId: user.id,
            },
        });
        console.log('✓ Created sample client:', client.fullName);
    }

    // Create sample food items
    const foodCount = await prisma.foodItem.count();
    if (foodCount === 0) {
        await prisma.foodItem.createMany({
            data: [
                { name: 'Oatmeal', category: 'grains', servingSizeG: 100, caloriesPer100g: 389, proteinPer100g: 17, carbsPer100g: 66, fatsPer100g: 7, isGlobal: true, isVerified: true },
                { name: 'Chicken Breast', category: 'proteins', servingSizeG: 100, caloriesPer100g: 165, proteinPer100g: 31, carbsPer100g: 0, fatsPer100g: 4, isGlobal: true, isVerified: true },
                { name: 'Brown Rice', category: 'grains', servingSizeG: 100, caloriesPer100g: 112, proteinPer100g: 2, carbsPer100g: 24, fatsPer100g: 1, isGlobal: true, isVerified: true },
                { name: 'Broccoli', category: 'vegetables', servingSizeG: 100, caloriesPer100g: 34, proteinPer100g: 3, carbsPer100g: 7, fatsPer100g: 0, isGlobal: true, isVerified: true },
                { name: 'Greek Yogurt', category: 'dairy', servingSizeG: 100, caloriesPer100g: 59, proteinPer100g: 10, carbsPer100g: 4, fatsPer100g: 0, isGlobal: true, isVerified: true },
                { name: 'Almonds', category: 'proteins', servingSizeG: 30, caloriesPer100g: 579, proteinPer100g: 21, carbsPer100g: 22, fatsPer100g: 50, isGlobal: true, isVerified: true },
            ],
        });
        console.log('✓ Created 6 sample food items');
    }

    console.log('\n✅ Setup complete! Restart your backend and try again.');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
