import 'package:flutter/material.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Baibesik Hırdavat',
          style: TextStyle(fontWeight: FontWeight.bold, color: Colors.black87),
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_none, color: Colors.black87),
            onPressed: () {},
          ),
        ],
      ),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 1. Arama Çubuğu
            const Padding(
              padding: EdgeInsets.all(16.0),
              child: SearchField(),
            ),

            // 2. Kategoriler Başlığı
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 16.0),
              child: Text(
                'Kategoriler',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
            ),
            const SizedBox(height: 10),

            // Yatay Kategori Listesi
            const CategoryList(),

            const SizedBox(height: 24),

            // 3. Öne Çıkan Esnaflar Başlığı
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 16.0),
              child: Text(
                'Yakındaki Esnaflar',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
            ),
            const SizedBox(height: 10),

            // Dikey Esnaf Listesi
            const ShopList(),
          ],
        ),
      ),
    );
  }
}

// --- Arama Çubuğu Bileşeni ---
class SearchField extends StatelessWidget {
  const SearchField({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return TextField(
      decoration: InputDecoration(
        hintText: 'Ürün veya esnaf ara...',
        prefixIcon: const Icon(Icons.search, color: Colors.grey),
        filled: true,
        fillColor: Colors.grey[100],
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
      ),
    );
  }
}

// --- Yatay Kategori Listesi Bileşeni ---
class CategoryList extends StatelessWidget {
  const CategoryList({Key? key}) : super(key: key);

  final List<Map<String, dynamic>> categories = const [
    {'name': 'Elektrik', 'icon': Icons.flash_on},
    {'name': 'Tesisat', 'icon': Icons.water_drop},
    {'name': 'El Aletleri', 'icon': Icons.build},
    {'name': 'Boya', 'icon': Icons.format_paint},
    {'name': 'Cıvata/Çivi', 'icon': Icons.category},
  ];

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 90,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        itemCount: categories.length,
        padding: const EdgeInsets.only(left: 16),
        itemBuilder: (context, index) {
          return Padding(
            padding: const EdgeInsets.only(right: 16.0),
            child: Column(
              children: [
                CircleAvatar(
                  radius: 28,
                  backgroundColor: Colors.amber.shade100,
                  child: Icon(categories[index]['icon'], color: Colors.amber.shade900),
                ),
                const SizedBox(height: 6),
                Text(
                  categories[index]['name'],
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

// --- Esnaf Listesi Bileşeni ---
class ShopList extends StatelessWidget {
  const ShopList({Key? key}) : super(key: key);

  final List<Map<String, String>> shops = const [
    {'name': 'Ahmet Hırdavat', 'distance': '450m uzaklıkta', 'rating': '4.8'},
    {'name': 'Baybesik Elektrik', 'distance': '1.2km uzaklıkta', 'rating': '4.6'},
    {'name': 'Usta Yapı Market', 'distance': '2.0km uzaklıkta', 'rating': '4.5'},
  ];

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(), // SingleChildScrollView içinde düzgün çalışması için
      itemCount: shops.length,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      itemBuilder: (context, index) {
        return Card(
          margin: const EdgeInsets.only(bottom: 12),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          elevation: 2,
          child: ListTile(
            leading: CircleAvatar(
              backgroundColor: Colors.grey[200],
              child: const Icon(Icons.store, color: Colors.blueGrey),
            ),
            title: Text(shops[index]['name']!, style: const TextStyle(fontWeight: FontWeight.bold)),
            subtitle: Text(shops[index]['distance']!),
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.star, color: Colors.amber, size: 20),
                const SizedBox(width: 4),
                Text(shops[index]['rating']!, style: const TextStyle(fontWeight: FontWeight.bold)),
              ],
            ),
            onTap: () {
              // İleride esnaf detay sayfasına gitmek için burayı kullanacağız
            },
          ),
        );
      },
    );
  }
}