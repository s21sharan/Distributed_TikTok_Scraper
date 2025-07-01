#!/usr/bin/env python3
"""
Test script to verify Python dependencies are installed correctly
"""

def test_imports():
    print("🧪 Testing Python dependencies...")
    
    tests = [
        ("requests", "requests"),
        ("selenium", "selenium"),
        ("webdriver_manager", "webdriver_manager.chrome"),
        ("beautifulsoup4", "bs4"),
        ("python-dotenv", "dotenv"),
    ]
    
    passed = 0
    failed = 0
    
    for package_name, import_name in tests:
        try:
            __import__(import_name)
            print(f"  ✅ {package_name}")
            passed += 1
        except ImportError as e:
            print(f"  ❌ {package_name}: {e}")
            failed += 1
    
    print(f"\n📊 Results: {passed} passed, {failed} failed")
    
    if failed == 0:
        print("🎉 All dependencies are installed correctly!")
        return True
    else:
        print("⚠️  Some dependencies are missing. Run the installation script again.")
        return False

if __name__ == "__main__":
    import sys
    success = test_imports()
    sys.exit(0 if success else 1) 