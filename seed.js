const { ObjectId } = require("mongodb");
const { connectDB, client } = require("./db");

const REVIEWS_TEMPLATE = [
  {
    userName: "Sarah Mitchell",
    userImage:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=60&h=60&fit=crop",
    rating: 5,
    comment:
      "Absolutely stunning property! Clean, spacious, and exactly as described. The host was incredibly responsive and helpful throughout our stay.",
    date: "2024-11-15",
  },
  {
    userName: "James Rodriguez",
    userImage:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=60&h=60&fit=crop",
    rating: 4,
    comment:
      "Great location and lovely amenities. Would definitely stay again. Minor issue with parking but overall a fantastic experience.",
    date: "2024-10-28",
  },
  {
    userName: "Priya Sharma",
    userImage:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=60&h=60&fit=crop",
    rating: 5,
    comment:
      "Perfect for our family. The neighborhood was safe, quiet, and the kids loved every inch of the property. Five stars without hesitation.",
    date: "2024-10-10",
  },
  {
    userName: "Tom Walters",
    userImage:
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=60&h=60&fit=crop",
    rating: 5,
    comment:
      "We extended our stay twice — that says it all. The property feels like a real home and the host goes above and beyond.",
    date: "2024-09-22",
  },
];

const USERS = [
  {
    _id: new ObjectId("674a00000000000000000001"),
    name: "Alex Johnson",
    email: "alex@example.com",
    image:
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=60&h=60&fit=crop",
    phone: "+1 (555) 000-0000",
    role: "host",
  },
  {
    _id: new ObjectId("674a00000000000000000002"),
    name: "Carlos Hernandez",
    email: "carlos.h@staynest.com",
    image:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop",
    phone: "+1 (305) 555-0198",
    role: "host",
  },
  {
    _id: new ObjectId("674a00000000000000000003"),
    name: "Emily Chen",
    email: "emily.c@staynest.com",
    image:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&fit=crop",
    phone: "+1 (212) 555-0147",
    role: "host",
  },
  {
    _id: new ObjectId("674a00000000000000000004"),
    name: "Marcus Webb",
    email: "marcus.w@staynest.com",
    image:
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop",
    phone: "+1 (323) 555-0264",
    role: "host",
  },
  {
    _id: new ObjectId("674a00000000000000000005"),
    name: "Priya Sharma",
    email: "priya.s@staynest.com",
    image:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=80&h=80&fit=crop",
    phone: "+1 (312) 555-0319",
    role: "host",
  },
  {
    _id: new ObjectId("674a00000000000000000006"),
    name: "David Park",
    email: "david.p@staynest.com",
    image:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop",
    phone: "+1 (530) 555-0427",
    role: "host",
  },
];

const PROPERTIES = [
  {
    title: "Luxury Oceanfront Villa with Private Pool",
    shortDescription:
      "Stunning 4-bed villa with private pool and direct ocean views. Ideal for families seeking resort-style living.",
    fullDescription:
      "Experience the ultimate in coastal luxury with this magnificent 4-bedroom oceanfront villa. Set across three floors with panoramic Atlantic Ocean views from every room, this property combines modern architecture with resort-style living.",
    rent: 4500,
    type: "villa",
    bedrooms: 4,
    bathrooms: 3,
    area: 2800,
    city: "Miami",
    address: "1247 Ocean Drive, Miami Beach, FL 33139",
    images: [
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=900&h=560&fit=crop",
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=900&h=560&fit=crop",
      "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=900&h=560&fit=crop",
    ],
    amenities: [
      "WiFi",
      "Pool",
      "Air Conditioning",
      "Gym",
      "Kitchen",
      "Smart TV",
      "Parking",
      "Security",
    ],
    rating: 4.9,
    reviewCount: 47,
    ownerId: USERS[1]._id,
    ownerName: USERS[1].name,
    ownerImage: USERS[1].image,
    ownerPhone: USERS[1].phone,
    ownerEmail: USERS[1].email,
    available: "2025-01-15",
    status: "available",
    featured: true,
    createdAt: "2024-06-01",
  },
  {
    title: "Modern Skyline Apartment in Midtown Manhattan",
    shortDescription:
      "Sleek 2-bed apartment with floor-to-ceiling windows and breathtaking NYC skyline views.",
    fullDescription:
      "Located in the heart of Midtown Manhattan, this contemporary 2-bedroom apartment offers breathtaking city skyline views from floor-to-ceiling windows.",
    rent: 5800,
    type: "apartment",
    bedrooms: 2,
    bathrooms: 2,
    area: 1200,
    city: "New York",
    address: "350 W 42nd St, New York, NY 10036",
    images: [
      "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=900&h=560&fit=crop",
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=900&h=560&fit=crop",
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=900&h=560&fit=crop",
    ],
    amenities: [
      "WiFi",
      "Air Conditioning",
      "Gym",
      "Kitchen",
      "Smart TV",
      "Concierge",
      "Rooftop Terrace",
    ],
    rating: 4.8,
    reviewCount: 63,
    ownerId: USERS[2]._id,
    ownerName: USERS[2].name,
    ownerImage: USERS[2].image,
    ownerPhone: USERS[2].phone,
    ownerEmail: USERS[2].email,
    available: "2025-01-01",
    status: "available",
    featured: true,
    createdAt: "2024-05-15",
  },
  {
    title: "Charming Craftsman Home in Silver Lake",
    shortDescription:
      "Beautifully restored 3-bed craftsman bungalow with sunlit garden and designer kitchen in trendy Silver Lake.",
    fullDescription:
      "Nestled in one of LA's most vibrant neighborhoods, this beautifully restored 3-bedroom Craftsman bungalow blends vintage charm with modern comforts.",
    rent: 3200,
    type: "house",
    bedrooms: 3,
    bathrooms: 2,
    area: 1750,
    city: "Los Angeles",
    address: "847 Griffith Park Blvd, Los Angeles, CA 90026",
    images: [
      "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=900&h=560&fit=crop",
      "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=900&h=560&fit=crop",
      "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=900&h=560&fit=crop",
    ],
    amenities: [
      "WiFi",
      "Air Conditioning",
      "Kitchen",
      "Smart TV",
      "Parking",
      "Washer/Dryer",
      "Garden",
    ],
    rating: 4.7,
    reviewCount: 38,
    ownerId: USERS[3]._id,
    ownerName: USERS[3].name,
    ownerImage: USERS[3].image,
    ownerPhone: USERS[3].phone,
    ownerEmail: USERS[3].email,
    available: "2025-02-01",
    status: "available",
    featured: true,
    createdAt: "2024-07-10",
  },
  {
    title: "Stylish River North Loft with City Views",
    shortDescription:
      "Industrial-chic 1-bed loft in Chicago's most sought-after River North neighborhood with spectacular skyline views.",
    fullDescription:
      "This stunning industrial-chic loft occupies the 18th floor of a converted warehouse in Chicago's vibrant River North arts district.",
    rent: 2800,
    type: "loft",
    bedrooms: 1,
    bathrooms: 1,
    area: 950,
    city: "Chicago",
    address: "412 N Wells St, Chicago, IL 60654",
    images: [
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=900&h=560&fit=crop",
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=900&h=560&fit=crop",
      "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=900&h=560&fit=crop",
    ],
    amenities: [
      "WiFi",
      "Air Conditioning",
      "Kitchen",
      "Smart TV",
      "Gym",
      "Rooftop",
      "Concierge",
    ],
    rating: 4.6,
    reviewCount: 29,
    ownerId: USERS[4]._id,
    ownerName: USERS[4].name,
    ownerImage: USERS[4].image,
    ownerPhone: USERS[4].phone,
    ownerEmail: USERS[4].email,
    available: "2025-01-20",
    status: "available",
    featured: true,
    createdAt: "2024-08-05",
  },
  {
    title: "Secluded Mountain Cabin near Lake Tahoe",
    shortDescription:
      "Cozy 2-bed log cabin surrounded by towering pines, with a stone fireplace and wraparound deck.",
    fullDescription:
      "Escape to this idyllic mountain cabin just 15 minutes from Lake Tahoe's south shore. Constructed from hand-hewn Douglas fir logs.",
    rent: 1900,
    type: "cabin",
    bedrooms: 2,
    bathrooms: 1,
    area: 1100,
    city: "San Francisco",
    address: "3280 Tahoe Keys Blvd, South Lake Tahoe, CA 96150",
    images: [
      "https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=900&h=560&fit=crop",
      "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=900&h=560&fit=crop",
      "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=900&h=560&fit=crop",
    ],
    amenities: [
      "WiFi",
      "Fireplace",
      "Kitchen",
      "Hot Tub",
      "BBQ Grill",
      "Parking",
      "Smart TV",
    ],
    rating: 4.9,
    reviewCount: 52,
    ownerId: USERS[5]._id,
    ownerName: USERS[5].name,
    ownerImage: USERS[5].image,
    ownerPhone: USERS[5].phone,
    ownerEmail: USERS[5].email,
    available: "2025-01-10",
    status: "available",
    featured: false,
    createdAt: "2024-04-20",
  },
  {
    title: "Sleek South Congress Studio with Hotel Perks",
    shortDescription:
      "Fully furnished studio in Austin's most vibrant corridor with concierge service and rooftop pool.",
    fullDescription:
      "Positioned on the lively South Congress Avenue, this turnkey studio apartment blends the privacy of home with the luxury of a boutique hotel.",
    rent: 1650,
    type: "studio",
    bedrooms: 1,
    bathrooms: 1,
    area: 650,
    city: "Austin",
    address: "1512 S Congress Ave, Austin, TX 78704",
    images: [
      "https://images.unsplash.com/photo-1554995207-c18c203602cb?w=900&h=560&fit=crop",
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=900&h=560&fit=crop",
      "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=900&h=560&fit=crop",
    ],
    amenities: [
      "WiFi",
      "Air Conditioning",
      "Kitchen",
      "Pool",
      "Gym",
      "Concierge",
      "Smart TV",
    ],
    rating: 4.5,
    reviewCount: 41,
    ownerId: USERS[0]._id,
    ownerName: USERS[0].name,
    ownerImage: USERS[0].image,
    ownerPhone: USERS[0].phone,
    ownerEmail: USERS[0].email,
    available: "2025-01-05",
    status: "available",
    featured: false,
    createdAt: "2024-09-12",
  },
  {
    title: "Beachfront Cottage on Miami's Key Biscayne",
    shortDescription:
      "Charming 2-bed cottage steps from the sand with a private dock and spectacular Biscayne Bay views.",
    fullDescription:
      "This enchanting beachfront cottage sits directly on Key Biscayne's pristine shoreline, offering unobstructed views of Biscayne Bay.",
    rent: 3800,
    type: "house",
    bedrooms: 2,
    bathrooms: 2,
    area: 1400,
    city: "Miami",
    address: "820 Crandon Blvd, Key Biscayne, FL 33149",
    images: [
      "https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=900&h=560&fit=crop",
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=900&h=560&fit=crop",
      "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=900&h=560&fit=crop",
    ],
    amenities: [
      "WiFi",
      "Air Conditioning",
      "Kitchen",
      "Private Dock",
      "BBQ Grill",
      "Parking",
      "Smart TV",
    ],
    rating: 4.8,
    reviewCount: 33,
    ownerId: USERS[1]._id,
    ownerName: USERS[1].name,
    ownerImage: USERS[1].image,
    ownerPhone: USERS[1].phone,
    ownerEmail: USERS[1].email,
    available: "2025-03-01",
    status: "rented",
    featured: false,
    createdAt: "2024-03-08",
  },
  {
    title: "Designer Penthouse in San Francisco's Nob Hill",
    shortDescription:
      "Extraordinary 3-bed penthouse with 360° views of the Bay, Golden Gate Bridge, and Alcatraz.",
    fullDescription:
      "Crowning the summit of Nob Hill, this extraordinary penthouse apartment offers some of the most coveted views in all of San Francisco.",
    rent: 8500,
    type: "apartment",
    bedrooms: 3,
    bathrooms: 3,
    area: 3200,
    city: "San Francisco",
    address: "1000 Mason St, San Francisco, CA 94108",
    images: [
      "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=900&h=560&fit=crop",
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=900&h=560&fit=crop",
      "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=900&h=560&fit=crop",
    ],
    amenities: [
      "WiFi",
      "Air Conditioning",
      "Gym",
      "Kitchen",
      "Smart TV",
      "Terrace",
      "Concierge",
      "Wine Cellar",
    ],
    rating: 5.0,
    reviewCount: 18,
    ownerId: USERS[0]._id,
    ownerName: USERS[0].name,
    ownerImage: USERS[0].image,
    ownerPhone: USERS[0].phone,
    ownerEmail: USERS[0].email,
    available: "2025-02-15",
    status: "available",
    featured: false,
    createdAt: "2024-02-14",
  },
  {
    title: "Historic Brooklyn Townhouse with Private Garden",
    shortDescription:
      "Beautifully renovated 4-bed brownstone townhouse in Park Slope with a landscaped private garden.",
    fullDescription:
      "This landmark 1890s brownstone has been meticulously restored and sensitively updated to offer modern living within a deeply historic shell.",
    rent: 6200,
    type: "house",
    bedrooms: 4,
    bathrooms: 3,
    area: 2600,
    city: "New York",
    address: "438 President St, Brooklyn, NY 11215",
    images: [
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=900&h=560&fit=crop",
      "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=900&h=560&fit=crop",
      "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=900&h=560&fit=crop",
    ],
    amenities: [
      "WiFi",
      "Garden",
      "Kitchen",
      "Smart TV",
      "Parking",
      "Fireplace",
      "Washer/Dryer",
    ],
    rating: 4.7,
    reviewCount: 26,
    ownerId: USERS[0]._id,
    ownerName: USERS[0].name,
    ownerImage: USERS[0].image,
    ownerPhone: USERS[0].phone,
    ownerEmail: USERS[0].email,
    available: "2025-04-01",
    status: "pending",
    featured: false,
    createdAt: "2024-01-30",
  },
  {
    title: "Bright Wicker Park Apartment with Rooftop",
    shortDescription:
      "Contemporary 2-bed apartment in Chicago's arts hub with access to a shared rooftop garden.",
    fullDescription:
      "Situated in the heart of Wicker Park, this bright, airy 2-bedroom apartment occupies the top floor of a fully renovated 1920s greystone.",
    rent: 2400,
    type: "apartment",
    bedrooms: 2,
    bathrooms: 1,
    area: 1050,
    city: "Chicago",
    address: "1642 N Damen Ave, Chicago, IL 60647",
    images: [
      "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=900&h=560&fit=crop",
      "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=900&h=560&fit=crop",
      "https://images.unsplash.com/photo-1554995207-c18c203602cb?w=900&h=560&fit=crop",
    ],
    amenities: [
      "WiFi",
      "Air Conditioning",
      "Kitchen",
      "Smart TV",
      "Rooftop",
      "Washer/Dryer",
    ],
    rating: 4.6,
    reviewCount: 34,
    ownerId: USERS[0]._id,
    ownerName: USERS[0].name,
    ownerImage: USERS[0].image,
    ownerPhone: USERS[0].phone,
    ownerEmail: USERS[0].email,
    available: "2025-01-25",
    status: "available",
    featured: false,
    createdAt: "2024-10-01",
  },
  {
    title: "East Austin Artist's Loft near Rainey Street",
    shortDescription:
      "Raw, sun-drenched 1-bed loft in a converted printing warehouse, 5 minutes from Rainey Street.",
    fullDescription:
      "Once the city's premier printing house, this thoughtfully converted loft retains its industrial heritage while offering refined contemporary comfort.",
    rent: 2100,
    type: "loft",
    bedrooms: 1,
    bathrooms: 1,
    area: 1100,
    city: "Austin",
    address: "78 Rainey St, Austin, TX 78701",
    images: [
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=900&h=560&fit=crop",
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=900&h=560&fit=crop",
      "https://images.unsplash.com/photo-1554995207-c18c203602cb?w=900&h=560&fit=crop",
    ],
    amenities: [
      "WiFi",
      "Air Conditioning",
      "Kitchen",
      "Smart TV",
      "Gym",
      "Bike Storage",
    ],
    rating: 4.5,
    reviewCount: 22,
    ownerId: USERS[0]._id,
    ownerName: USERS[0].name,
    ownerImage: USERS[0].image,
    ownerPhone: USERS[0].phone,
    ownerEmail: USERS[0].email,
    available: "2025-02-10",
    status: "available",
    featured: false,
    createdAt: "2024-11-05",
  },
  {
    title: "Malibu Cliffside Home with Infinity Pool",
    shortDescription:
      "Iconic 5-bed architectural masterpiece perched above the Pacific with an infinity pool and private beach access.",
    fullDescription:
      "This iconic five-bedroom Malibu retreat sits dramatically above the Pacific on a private 3-acre promontory.",
    rent: 15000,
    type: "villa",
    bedrooms: 5,
    bathrooms: 5,
    area: 6800,
    city: "Los Angeles",
    address: "24200 Pacific Coast Hwy, Malibu, CA 90265",
    images: [
      "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=900&h=560&fit=crop",
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=900&h=560&fit=crop",
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=900&h=560&fit=crop",
    ],
    amenities: [
      "WiFi",
      "Infinity Pool",
      "Air Conditioning",
      "Gym",
      "Private Beach",
      "Smart TV",
      "Concierge",
      "Wine Cellar",
      "Home Theater",
    ],
    rating: 5.0,
    reviewCount: 11,
    ownerId: USERS[0]._id,
    ownerName: USERS[0].name,
    ownerImage: USERS[0].image,
    ownerPhone: USERS[0].phone,
    ownerEmail: USERS[0].email,
    available: "2025-03-15",
    status: "available",
    featured: false,
    createdAt: "2024-12-01",
  },
];

async function seed() {
  try {
    const db = await connectDB();

    await db.collection("users").deleteMany({});
    await db.collection("properties").deleteMany({});
    await db.collection("reviews").deleteMany({});

    await db.collection("users").insertMany(USERS);
    const propertyResult = await db.collection("properties").insertMany(PROPERTIES);
    const propertyIds = Object.values(propertyResult.insertedIds);

    const reviews = [];
    propertyIds.forEach((propertyId, index) => {
      REVIEWS_TEMPLATE.forEach((review, rIndex) => {
        reviews.push({
          propertyId,
          userName: review.userName,
          userImage: review.userImage,
          rating: review.rating,
          comment: review.comment,
          date: review.date,
          createdAt: new Date().toISOString(),
        });
      });
      if (index % 2 === 0) {
        reviews.push({
          propertyId,
          userName: "Amanda Foster",
          userImage:
            "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=60&h=60&fit=crop",
          rating: 5,
          comment:
            "Exceeded all expectations. The photos don't do justice to how beautiful this place is in person.",
          date: "2024-08-15",
          createdAt: new Date().toISOString(),
        });
      }
    });

    await db.collection("reviews").insertMany(reviews);

    console.log(`Seeded ${USERS.length} users`);
    console.log(`Seeded ${propertyIds.length} properties`);
    console.log(`Seeded ${reviews.length} reviews`);
    console.log("Database seeded successfully!");
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  } finally {
    await client.close();
    process.exit(0);
  }
}

seed();
