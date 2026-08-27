# 🚀 Guide d'Utilisation avec Expo Go (Android)

Ce projet est désormais entièrement configuré pour être exécuté et testé directement sur votre smartphone Android via **Expo Go**.

---

## 📱 Étape 1 : Installer Expo Go sur votre téléphone Android
1. Ouvrez le **Google Play Store** sur votre smartphone.
2. Recherchez et installez **Expo Go**.

---

## ⚡ Étape 2 : Lancer le projet en mode Expo

Dans votre terminal (ou après avoir exporté le projet via GitHub/ZIP) :

```bash
# 1. Installer les dépendances Expo si nécessaire
npx expo install react-native-webview

# 2. Lancer le serveur Metro Expo
npx expo start
```

---

## 📲 Étape 3 : Scanner et Tester sur votre téléphone
1. Un **QR Code** apparaîtra dans votre terminal (ou dans l'interface web Expo).
2. Ouvrez l'application **Expo Go** sur votre téléphone Android.
3. Appuyez sur **"Scan QR Code"** et scannez le QR code.
4. L'application OpenJarvis se chargera instantanément avec :
   - Accès direct au microphone pour l'interaction vocale continue (Full Duplex).
   - Accès à la caméra pour Vision Studio.
   - Mode plein écran avec barre d'état stylisée Stark Industries.
   - Prise en charge du bouton retour matériel d'Android.

---

## 🛠️ Configuration des Fichiers Expo Créés
- `app.json` : Manifeste Expo complet (nom, icône, package Android `com.openjarvis.assistant`, autorisations micro/caméra/localisation).
- `eas.json` : Profils de build pour exporter en `.apk` autonome avec `eas build -p android --profile preview`.
- `App.expo.js` : Point d'entrée mobile optimisé pour Android & Expo Go.
