import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding data...');

  // 1. Create Categories
  const categoryNames = ['科技', '生活', '美食', '旅行', '时尚'];
  const categories = [];

  for (const name of categoryNames) {
    // Try to find by name first to avoid duplicates
    let cat = await prisma.category.findUnique({ where: { name } });
    
    if (!cat) {
      const slug = `cat-${Math.random().toString(36).substring(7)}-${Date.now()}`;
      console.log(`Creating category: ${name}`);
      cat = await prisma.category.create({
        data: {
          name,
          slug, 
          description: `${name} related content`
        }
      });
    }
    categories.push(cat);
  }
  console.log(`Ensured ${categories.length} categories.`);

  // 2. Create Tags
  const tagNames = ['前端', '后端', '数据库', 'JavaScript', 'Python', 'Vue', 'React', 'Node.js', 'Docker', 'AI'];
  const tags = [];

  for (const name of tagNames) {
    let tag = await prisma.tag.findUnique({ where: { name } });
    
    if (!tag) {
      const slug = `tag-${Math.random().toString(36).substring(7)}-${Date.now()}`;
      console.log(`Creating tag: ${name}`);
      tag = await prisma.tag.create({
        data: {
          name,
          slug,
          color: '#' + Math.floor(Math.random()*16777215).toString(16)
        }
      });
    }
    tags.push(tag);
  }
  console.log(`Ensured ${tags.length} tags.`);

  // 3. Create Items
  const count = await prisma.item.count();
  if (count < 50) {
    const itemsToCreate = 50 - count;
    console.log(`Creating ${itemsToCreate} items...`);

    for (let i = 0; i < itemsToCreate; i++) {
      const randomCat = categories[Math.floor(Math.random() * categories.length)];
      // Pick random tags (1 to 3)
      const shuffledTags = [...tags].sort(() => 0.5 - Math.random());
      const selectedTags = shuffledTags.slice(0, Math.floor(Math.random() * 3) + 1);

      await prisma.item.create({
        data: {
          title: `测试条目 ${count + i + 1} - ${randomCat.name}`,
          content: `这是第 ${count + i + 1} 条测试数据的详细内容。包含分类 ${randomCat.name} 和一些随机标签。`,
          categoryId: randomCat.id,
          tags: {
            connect: selectedTags.map(t => ({ id: t.id }))
          }
        }
      });
    }
    console.log(`Created ${itemsToCreate} new items.`);
  } else {
    console.log(`Already have ${count} items, skipping creation.`);
  }

  console.log('Seeding completed.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
