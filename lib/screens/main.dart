import 'package:flutter/material.dart';
// Kendi proje adın neyse 'proje_adin' kısmını onunla değiştir kanka
import 'package:baibesik_hirdavat/screens/dashboard_screen.dart'; 

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Baibesik Hırdavat',
      theme: ThemeData(
        primarySwatch: Colors.amber, // Hırdavat konseptine sarı/turuncu tonları yakışır
        scaffoldBackgroundColor: Colors.white,
      ),
      // Uygulama ilk açıldığında bizim oluşturduğumuz ekranı yükleyecek
      home: const DashboardScreen(), 
    );
  }
}
