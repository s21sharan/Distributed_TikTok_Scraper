#!/usr/bin/env python3
"""
Test script to demonstrate TikTok date parsing functionality
"""

import re
from datetime import datetime, timedelta

def parse_upload_date(date_str):
    """
    Parse TikTok upload date strings into proper datetime objects.
    Handles multiple formats:
    - Relative dates: "3d ago", "2w ago", "1m ago", "1y ago"
    - Partial dates: "4-25" (month-day, current year assumed)
    - Full dates: "2024-12-23"
    
    Args:
        date_str (str): Date string from TikTok
        
    Returns:
        str: ISO formatted date string or None if parsing fails
    """
    if not date_str:
        return None
    
    date_str = date_str.strip()
    now = datetime.now()
    
    try:
        # Handle relative dates like "3d ago", "2w ago", "1m ago", "1y ago"
        if 'ago' in date_str.lower():
            # Extract number and unit
            match = re.match(r'(\d+)([dwmy])\s*ago', date_str.lower())
            if match:
                num = int(match.group(1))
                unit = match.group(2)
                
                if unit == 'd':  # days
                    upload_date = now - timedelta(days=num)
                elif unit == 'w':  # weeks
                    upload_date = now - timedelta(weeks=num)
                elif unit == 'm':  # months (approximate)
                    upload_date = now - timedelta(days=num * 30)
                elif unit == 'y':  # years (approximate)
                    upload_date = now - timedelta(days=num * 365)
                else:
                    return None
                
                return upload_date.isoformat()
        
        # Handle partial dates like "4-25" (month-day format)
        elif re.match(r'^\d{1,2}-\d{1,2}$', date_str):
            month, day = map(int, date_str.split('-'))
            # Use current year, but if the date is in the future, use previous year
            year = now.year
            try:
                upload_date = datetime(year, month, day)
                if upload_date > now:
                    upload_date = datetime(year - 1, month, day)
                return upload_date.isoformat()
            except ValueError:
                # Invalid date (e.g., Feb 30)
                return None
        
        # Handle full dates like "2024-12-23"
        elif re.match(r'^\d{4}-\d{1,2}-\d{1,2}$', date_str):
            try:
                upload_date = datetime.strptime(date_str, '%Y-%m-%d')
                return upload_date.isoformat()
            except ValueError:
                return None
        
        # Handle other potential formats
        else:
            print(f"   ⚠️  Unknown date format: {date_str}")
            return None
            
    except Exception as e:
        print(f"   ❌ Error parsing date '{date_str}': {e}")
        return None

def test_date_parsing():
    """Test the date parsing function with various formats"""
    
    test_cases = [
        # The three formats you provided
        "3d ago",
        "4-25", 
        "2024-12-23",
        
        # Additional test cases
        "1d ago",
        "2w ago",
        "1m ago",
        "1y ago",
        "12-31",
        "1-1",
        "2023-01-15",
        "2025-06-30",
        "",
        "invalid",
        "25d ago",
        "15w ago"
    ]
    
    print("🧪 Testing TikTok Date Parsing Functionality")
    print("=" * 60)
    print(f"Current time: {datetime.now().isoformat()}")
    print()
    
    for i, test_date in enumerate(test_cases, 1):
        result = parse_upload_date(test_date)
        status = "✅" if result else "❌"
        print(f"{i:2d}. {status} '{test_date}' → {result}")
    
    print("\n🎯 Expected behavior:")
    print("• Relative dates (3d ago) → calculated from current time")
    print("• Partial dates (4-25) → current year, or previous year if future")
    print("• Full dates (2024-12-23) → exact date parsing")
    print("• Invalid formats → None")

if __name__ == "__main__":
    test_date_parsing() 