// import { App } from '@onexone/api-client';

// export function generateFlutterTheme(app: App, outputDir: string) {
//   console.log(chalk.blue('🎨 Generating Flutter Theme...'));
  
//   const primary = parseColor(app.primary_color, '0xFF000000');
//   const secondary = parseColor(app.secondary_color, '0xFFFFFFFF');
//   const background = parseColor(app.primary_color, '0xFFF5F5F5');
//   const surface = parseColor("colors.surface,", '0xFFFFFFFF');
//   const error = parseColor("colors.error", '0xFFB00020');

//   // 2. Create the Dart Content
//   const dartContent = `// GENERATED CODE - DO NOT MODIFY BY HAND
// import 'package:flutter/material.dart';

// class AppTheme {
//   static const Color primary = Color(${primary});
//   static const Color secondary = Color(${secondary});
//   static const Color background = Color(${background});
//   static const Color surface = Color(${surface});
//   static const Color error = Color(${error});

//   static ThemeData get themeData {
//     return ThemeData(
//       primaryColor: primary,
//       scaffoldBackgroundColor: background,
//       colorScheme: ColorScheme.light(
//         primary: primary,
//         secondary: secondary,
//         surface: surface,
//         error: error,
//       ),
//       useMaterial3: true,
//     );
//   }
// }
// `;

//   // 3. Write to file
//   if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  
//   const filePath = path.join(outputDir, 'app_theme.dart');
//   fs.writeFileSync(filePath, dartContent);

//   console.log(chalk.green(`✅ Flutter theme saved to: ${filePath}`));
// }

// /**
//  * Helper: Converts "#FFFFFF" -> "0xFFFFFFFF"
//  */
// function parseColor(hex: string | undefined, fallback: string): string {
//   if (!hex) return fallback;
  
//   // Remove # if present
//   let cleanHex = hex.replace('#', '');
  
//   // Handle 3-digit hex (e.g., "FFF")
//   if (cleanHex.length === 3) {
//     cleanHex = cleanHex.split('').map(c => c + c).join('');
//   }

//   // Ensure 6 digits
//   if (cleanHex.length !== 6) return fallback;

//   return `0xFF${cleanHex.toUpperCase()}`;
// }