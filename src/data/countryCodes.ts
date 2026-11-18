export interface CountryCodeOption {
  iso2: string;
  name: string;
  dialCode: string;
  flag: string;
  minDigits: number;
  maxDigits: number;
  example: string;
}

export const DEFAULT_COUNTRY_ISO = 'SA';

export const COUNTRY_CODES: readonly CountryCodeOption[] = [
  // Primary / Regional Priority (Saudi Arabia default first, followed by GCC & frequent international)
  { iso2: 'SA', name: 'Saudi Arabia', dialCode: '+966', flag: '🇸🇦', minDigits: 9, maxDigits: 9, example: '50 123 4567' },
  { iso2: 'AE', name: 'United Arab Emirates', dialCode: '+971', flag: '🇦🇪', minDigits: 9, maxDigits: 9, example: '50 123 4567' },
  { iso2: 'QA', name: 'Qatar', dialCode: '+974', flag: '🇶🇦', minDigits: 8, maxDigits: 8, example: '3312 3456' },
  { iso2: 'KW', name: 'Kuwait', dialCode: '+965', flag: '🇰🇼', minDigits: 8, maxDigits: 8, example: '5001 2345' },
  { iso2: 'BH', name: 'Bahrain', dialCode: '+973', flag: '🇧🇭', minDigits: 8, maxDigits: 8, example: '3600 1234' },
  { iso2: 'OM', name: 'Oman', dialCode: '+968', flag: '🇴🇲', minDigits: 8, maxDigits: 8, example: '9212 3456' },
  { iso2: 'JO', name: 'Jordan', dialCode: '+962', flag: '🇯🇴', minDigits: 9, maxDigits: 9, example: '79 123 4567' },
  { iso2: 'EG', name: 'Egypt', dialCode: '+20', flag: '🇪🇬', minDigits: 10, maxDigits: 10, example: '10 1234 5678' },
  { iso2: 'LB', name: 'Lebanon', dialCode: '+961', flag: '🇱🇧', minDigits: 7, maxDigits: 8, example: '71 123 456' },
  { iso2: 'GB', name: 'United Kingdom', dialCode: '+44', flag: '🇬🇧', minDigits: 10, maxDigits: 10, example: '7700 900123' },
  { iso2: 'US', name: 'United States', dialCode: '+1', flag: '🇺🇸', minDigits: 10, maxDigits: 10, example: '415 555 0134' },
  { iso2: 'CA', name: 'Canada', dialCode: '+1', flag: '🇨🇦', minDigits: 10, maxDigits: 10, example: '416 555 0198' },
  // Alphabetical Global Directory
  { iso2: 'AF', name: 'Afghanistan', dialCode: '+93', flag: '🇦🇫', minDigits: 9, maxDigits: 9, example: '70 123 4567' },
  { iso2: 'AL', name: 'Albania', dialCode: '+355', flag: '🇦🇱', minDigits: 8, maxDigits: 9, example: '67 212 3456' },
  { iso2: 'DZ', name: 'Algeria', dialCode: '+213', flag: '🇩🇿', minDigits: 9, maxDigits: 9, example: '551 23 45 67' },
  { iso2: 'AD', name: 'Andorra', dialCode: '+376', flag: '🇦🇩', minDigits: 6, maxDigits: 9, example: '312 345' },
  { iso2: 'AO', name: 'Angola', dialCode: '+244', flag: '🇦🇴', minDigits: 9, maxDigits: 9, example: '923 123 456' },
  { iso2: 'AG', name: 'Antigua and Barbuda', dialCode: '+1268', flag: '🇦🇬', minDigits: 7, maxDigits: 7, example: '464 1234' },
  { iso2: 'AR', name: 'Argentina', dialCode: '+54', flag: '🇦🇷', minDigits: 10, maxDigits: 11, example: '11 2345 6789' },
  { iso2: 'AM', name: 'Armenia', dialCode: '+374', flag: '🇦🇲', minDigits: 8, maxDigits: 8, example: '77 123456' },
  { iso2: 'AU', name: 'Australia', dialCode: '+61', flag: '🇦🇺', minDigits: 9, maxDigits: 9, example: '412 345 678' },
  { iso2: 'AT', name: 'Austria', dialCode: '+43', flag: '🇦🇹', minDigits: 7, maxDigits: 13, example: '664 123456' },
  { iso2: 'AZ', name: 'Azerbaijan', dialCode: '+994', flag: '🇦🇿', minDigits: 9, maxDigits: 9, example: '40 123 45 67' },
  { iso2: 'BS', name: 'Bahamas', dialCode: '+1242', flag: '🇧🇸', minDigits: 7, maxDigits: 7, example: '359 1234' },
  { iso2: 'BD', name: 'Bangladesh', dialCode: '+880', flag: '🇧🇩', minDigits: 10, maxDigits: 10, example: '1812 345678' },
  { iso2: 'BB', name: 'Barbados', dialCode: '+1246', flag: '🇧🇧', minDigits: 7, maxDigits: 7, example: '250 1234' },
  { iso2: 'BY', name: 'Belarus', dialCode: '+375', flag: '🇧🇾', minDigits: 9, maxDigits: 9, example: '29 491 19 11' },
  { iso2: 'BE', name: 'Belgium', dialCode: '+32', flag: '🇧🇪', minDigits: 8, maxDigits: 9, example: '470 12 34 56' },
  { iso2: 'BZ', name: 'Belize', dialCode: '+501', flag: '🇧🇿', minDigits: 7, maxDigits: 7, example: '622 1234' },
  { iso2: 'BJ', name: 'Benin', dialCode: '+229', flag: '🇧🇯', minDigits: 8, maxDigits: 8, example: '90 01 12 34' },
  { iso2: 'BT', name: 'Bhutan', dialCode: '+975', flag: '🇧🇹', minDigits: 8, maxDigits: 8, example: '17 12 34 56' },
  { iso2: 'BO', name: 'Bolivia', dialCode: '+591', flag: '🇧🇴', minDigits: 8, maxDigits: 8, example: '71234567' },
  { iso2: 'BA', name: 'Bosnia and Herzegovina', dialCode: '+387', flag: '🇧🇦', minDigits: 8, maxDigits: 8, example: '61 123 456' },
  { iso2: 'BW', name: 'Botswana', dialCode: '+267', flag: '🇧🇼', minDigits: 7, maxDigits: 8, example: '71 123 456' },
  { iso2: 'BR', name: 'Brazil', dialCode: '+55', flag: '🇧🇷', minDigits: 10, maxDigits: 11, example: '11 96123 4567' },
  { iso2: 'BN', name: 'Brunei', dialCode: '+673', flag: '🇧🇳', minDigits: 7, maxDigits: 7, example: '712 3456' },
  { iso2: 'BG', name: 'Bulgaria', dialCode: '+359', flag: '🇧🇬', minDigits: 8, maxDigits: 9, example: '88 123 4567' },
  { iso2: 'BF', name: 'Burkina Faso', dialCode: '+226', flag: '🇧🇫', minDigits: 8, maxDigits: 8, example: '70 12 34 56' },
  { iso2: 'BI', name: 'Burundi', dialCode: '+257', flag: '🇧🇮', minDigits: 8, maxDigits: 8, example: '79 561 234' },
  { iso2: 'KH', name: 'Cambodia', dialCode: '+855', flag: '🇰🇭', minDigits: 8, maxDigits: 9, example: '91 234 567' },
  { iso2: 'CM', name: 'Cameroon', dialCode: '+237', flag: '🇨🇲', minDigits: 9, maxDigits: 9, example: '6 71 23 45 67' },
  { iso2: 'CV', name: 'Cape Verde', dialCode: '+238', flag: '🇨🇻', minDigits: 7, maxDigits: 7, example: '991 12 34' },
  { iso2: 'CF', name: 'Central African Republic', dialCode: '+236', flag: '🇨🇫', minDigits: 8, maxDigits: 8, example: '70 01 23 45' },
  { iso2: 'TD', name: 'Chad', dialCode: '+235', flag: '🇹🇩', minDigits: 8, maxDigits: 8, example: '63 01 23 45' },
  { iso2: 'CL', name: 'Chile', dialCode: '+56', flag: '🇨🇱', minDigits: 9, maxDigits: 9, example: '9 6123 4567' },
  { iso2: 'CN', name: 'China', dialCode: '+86', flag: '🇨🇳', minDigits: 11, maxDigits: 11, example: '131 2345 6789' },
  { iso2: 'CO', name: 'Colombia', dialCode: '+57', flag: '🇨🇴', minDigits: 10, maxDigits: 10, example: '321 1234567' },
  { iso2: 'KM', name: 'Comoros', dialCode: '+269', flag: '🇰🇲', minDigits: 7, maxDigits: 7, example: '321 23 45' },
  { iso2: 'CG', name: 'Congo', dialCode: '+242', flag: '🇨🇬', minDigits: 9, maxDigits: 9, example: '06 123 4567' },
  { iso2: 'CD', name: 'Congo (DRC)', dialCode: '+243', flag: '🇨🇩', minDigits: 9, maxDigits: 9, example: '991 234 567' },
  { iso2: 'CR', name: 'Costa Rica', dialCode: '+506', flag: '🇨🇷', minDigits: 8, maxDigits: 8, example: '8312 3456' },
  { iso2: 'CI', name: "Cote d'Ivoire", dialCode: '+225', flag: '🇨🇮', minDigits: 8, maxDigits: 10, example: '01 23 45 67 89' },
  { iso2: 'HR', name: 'Croatia', dialCode: '+385', flag: '🇭🇷', minDigits: 8, maxDigits: 9, example: '91 234 5678' },
  { iso2: 'CU', name: 'Cuba', dialCode: '+53', flag: '🇨🇺', minDigits: 8, maxDigits: 8, example: '5 1234567' },
  { iso2: 'CY', name: 'Cyprus', dialCode: '+357', flag: '🇨🇾', minDigits: 8, maxDigits: 8, example: '96 123456' },
  { iso2: 'CZ', name: 'Czech Republic', dialCode: '+420', flag: '🇨🇿', minDigits: 9, maxDigits: 9, example: '601 123 456' },
  { iso2: 'DK', name: 'Denmark', dialCode: '+45', flag: '🇩🇰', minDigits: 8, maxDigits: 8, example: '20 12 34 56' },
  { iso2: 'DJ', name: 'Djibouti', dialCode: '+253', flag: '🇩🇯', minDigits: 8, maxDigits: 8, example: '77 83 10 01' },
  { iso2: 'DM', name: 'Dominica', dialCode: '+1767', flag: '🇩🇲', minDigits: 7, maxDigits: 7, example: '225 1234' },
  { iso2: 'DO', name: 'Dominican Republic', dialCode: '+1809', flag: '🇩🇴', minDigits: 7, maxDigits: 7, example: '234 5678' },
  { iso2: 'EC', name: 'Ecuador', dialCode: '+593', flag: '🇪🇨', minDigits: 9, maxDigits: 9, example: '99 123 4567' },
  { iso2: 'SV', name: 'El Salvador', dialCode: '+503', flag: '🇸🇻', minDigits: 8, maxDigits: 8, example: '7012 3456' },
  { iso2: 'GQ', name: 'Equatorial Guinea', dialCode: '+240', flag: '🇬🇶', minDigits: 9, maxDigits: 9, example: '222 123 456' },
  { iso2: 'ER', name: 'Eritrea', dialCode: '+291', flag: '🇪🇷', minDigits: 7, maxDigits: 7, example: '7 123 456' },
  { iso2: 'EE', name: 'Estonia', dialCode: '+372', flag: '🇪🇪', minDigits: 7, maxDigits: 8, example: '5123 4567' },
  { iso2: 'SZ', name: 'Eswatini', dialCode: '+268', flag: '🇸🇿', minDigits: 8, maxDigits: 8, example: '7612 3456' },
  { iso2: 'ET', name: 'Ethiopia', dialCode: '+251', flag: '🇪🇹', minDigits: 9, maxDigits: 9, example: '91 123 4567' },
  { iso2: 'FJ', name: 'Fiji', dialCode: '+679', flag: '🇫🇯', minDigits: 7, maxDigits: 7, example: '701 2345' },
  { iso2: 'FI', name: 'Finland', dialCode: '+358', flag: '🇫🇮', minDigits: 7, maxDigits: 11, example: '41 2345678' },
  { iso2: 'FR', name: 'France', dialCode: '+33', flag: '🇫🇷', minDigits: 9, maxDigits: 9, example: '6 12 34 56 78' },
  { iso2: 'GA', name: 'Gabon', dialCode: '+241', flag: '🇬🇦', minDigits: 7, maxDigits: 8, example: '06 03 12 34' },
  { iso2: 'GM', name: 'Gambia', dialCode: '+220', flag: '🇬🇲', minDigits: 7, maxDigits: 7, example: '301 2345' },
  { iso2: 'GE', name: 'Georgia', dialCode: '+995', flag: '🇬🇪', minDigits: 9, maxDigits: 9, example: '555 12 34 56' },
  { iso2: 'DE', name: 'Germany', dialCode: '+49', flag: '🇩🇪', minDigits: 8, maxDigits: 12, example: '151 23456789' },
  { iso2: 'GH', name: 'Ghana', dialCode: '+233', flag: '🇬🇭', minDigits: 9, maxDigits: 9, example: '23 123 4567' },
  { iso2: 'GR', name: 'Greece', dialCode: '+30', flag: '🇬🇷', minDigits: 10, maxDigits: 10, example: '691 234 5678' },
  { iso2: 'GD', name: 'Grenada', dialCode: '+1473', flag: '🇬🇩', minDigits: 7, maxDigits: 7, example: '403 1234' },
  { iso2: 'GT', name: 'Guatemala', dialCode: '+502', flag: '🇬🇹', minDigits: 8, maxDigits: 8, example: '5123 4567' },
  { iso2: 'GN', name: 'Guinea', dialCode: '+224', flag: '🇬🇳', minDigits: 8, maxDigits: 9, example: '601 12 34 56' },
  { iso2: 'GW', name: 'Guinea-Bissau', dialCode: '+245', flag: '🇬🇼', minDigits: 7, maxDigits: 9, example: '955 012 345' },
  { iso2: 'GY', name: 'Guyana', dialCode: '+592', flag: '🇬🇾', minDigits: 7, maxDigits: 7, example: '609 1234' },
  { iso2: 'HT', name: 'Haiti', dialCode: '+509', flag: '🇭🇹', minDigits: 8, maxDigits: 8, example: '34 10 1234' },
  { iso2: 'HN', name: 'Honduras', dialCode: '+504', flag: '🇭🇳', minDigits: 8, maxDigits: 8, example: '9123 4567' },
  { iso2: 'HK', name: 'Hong Kong', dialCode: '+852', flag: '🇭🇰', minDigits: 8, maxDigits: 8, example: '5123 4567' },
  { iso2: 'HU', name: 'Hungary', dialCode: '+36', flag: '🇭🇺', minDigits: 8, maxDigits: 9, example: '20 123 4567' },
  { iso2: 'IS', name: 'Iceland', dialCode: '+354', flag: '🇮🇸', minDigits: 7, maxDigits: 7, example: '611 1234' },
  { iso2: 'IN', name: 'India', dialCode: '+91', flag: '🇮🇳', minDigits: 10, maxDigits: 10, example: '81234 56789' },
  { iso2: 'ID', name: 'Indonesia', dialCode: '+62', flag: '🇮🇩', minDigits: 9, maxDigits: 12, example: '812 3456 7890' },
  { iso2: 'IR', name: 'Iran', dialCode: '+98', flag: '🇮🇷', minDigits: 10, maxDigits: 10, example: '912 345 6789' },
  { iso2: 'IQ', name: 'Iraq', dialCode: '+964', flag: '🇮🇶', minDigits: 10, maxDigits: 10, example: '791 234 5678' },
  { iso2: 'IE', name: 'Ireland', dialCode: '+353', flag: '🇮🇪', minDigits: 8, maxDigits: 9, example: '85 012 3456' },
  { iso2: 'IT', name: 'Italy', dialCode: '+39', flag: '🇮🇹', minDigits: 8, maxDigits: 11, example: '312 345 6789' },
  { iso2: 'JM', name: 'Jamaica', dialCode: '+1876', flag: '🇯🇲', minDigits: 7, maxDigits: 7, example: '210 1234' },
  { iso2: 'JP', name: 'Japan', dialCode: '+81', flag: '🇯🇵', minDigits: 9, maxDigits: 10, example: '90 1234 5678' },
  { iso2: 'KZ', name: 'Kazakhstan', dialCode: '+7', flag: '🇰🇿', minDigits: 10, maxDigits: 10, example: '771 000 9998' },
  { iso2: 'KE', name: 'Kenya', dialCode: '+254', flag: '🇰🇪', minDigits: 9, maxDigits: 9, example: '712 123456' },
  { iso2: 'KI', name: 'Kiribati', dialCode: '+686', flag: '🇰🇮', minDigits: 5, maxDigits: 8, example: '72001234' },
  { iso2: 'KR', name: 'South Korea', dialCode: '+82', flag: '🇰🇷', minDigits: 9, maxDigits: 10, example: '10 1234 5678' },
  { iso2: 'KG', name: 'Kyrgyzstan', dialCode: '+996', flag: '🇰🇬', minDigits: 9, maxDigits: 9, example: '700 123 456' },
  { iso2: 'LA', name: 'Laos', dialCode: '+856', flag: '🇱🇦', minDigits: 8, maxDigits: 10, example: '20 23 123 456' },
  { iso2: 'LV', name: 'Latvia', dialCode: '+371', flag: '🇱🇻', minDigits: 8, maxDigits: 8, example: '21 234 567' },
  { iso2: 'LS', name: 'Lesotho', dialCode: '+266', flag: '🇱🇸', minDigits: 8, maxDigits: 8, example: '5012 3456' },
  { iso2: 'LR', name: 'Liberia', dialCode: '+231', flag: '🇱🇷', minDigits: 7, maxDigits: 9, example: '77 012 3456' },
  { iso2: 'LY', name: 'Libya', dialCode: '+218', flag: '🇱🇾', minDigits: 9, maxDigits: 9, example: '91 2345678' },
  { iso2: 'LI', name: 'Liechtenstein', dialCode: '+423', flag: '🇱🇮', minDigits: 7, maxDigits: 9, example: '660 234 567' },
  { iso2: 'LT', name: 'Lithuania', dialCode: '+370', flag: '🇱🇹', minDigits: 8, maxDigits: 8, example: '612 34567' },
  { iso2: 'LU', name: 'Luxembourg', dialCode: '+352', flag: '🇱🇺', minDigits: 6, maxDigits: 11, example: '628 123 456' },
  { iso2: 'MO', name: 'Macau', dialCode: '+853', flag: '🇲🇴', minDigits: 8, maxDigits: 8, example: '6612 3456' },
  { iso2: 'MG', name: 'Madagascar', dialCode: '+261', flag: '🇲🇬', minDigits: 9, maxDigits: 9, example: '32 12 345 67' },
  { iso2: 'MW', name: 'Malawi', dialCode: '+265', flag: '🇲🇼', minDigits: 7, maxDigits: 9, example: '991 23 45 67' },
  { iso2: 'MY', name: 'Malaysia', dialCode: '+60', flag: '🇲🇾', minDigits: 9, maxDigits: 10, example: '12 345 6789' },
  { iso2: 'MV', name: 'Maldives', dialCode: '+960', flag: '🇲🇻', minDigits: 7, maxDigits: 7, example: '771 2345' },
  { iso2: 'ML', name: 'Mali', dialCode: '+223', flag: '🇲🇱', minDigits: 8, maxDigits: 8, example: '65 01 23 45' },
  { iso2: 'MT', name: 'Malta', dialCode: '+356', flag: '🇲🇹', minDigits: 8, maxDigits: 8, example: '9696 1234' },
  { iso2: 'MR', name: 'Mauritania', dialCode: '+222', flag: '🇲🇷', minDigits: 8, maxDigits: 8, example: '22 12 34 56' },
  { iso2: 'MU', name: 'Mauritius', dialCode: '+230', flag: '🇲🇺', minDigits: 7, maxDigits: 8, example: '5251 2345' },
  { iso2: 'MX', name: 'Mexico', dialCode: '+52', flag: '🇲🇽', minDigits: 10, maxDigits: 10, example: '222 123 4567' },
  { iso2: 'MD', name: 'Moldova', dialCode: '+373', flag: '🇲🇩', minDigits: 8, maxDigits: 8, example: '621 12 345' },
  { iso2: 'MC', name: 'Monaco', dialCode: '+377', flag: '🇲🇨', minDigits: 8, maxDigits: 9, example: '6 12 34 56 78' },
  { iso2: 'MN', name: 'Mongolia', dialCode: '+976', flag: '🇲🇳', minDigits: 8, maxDigits: 8, example: '8812 3456' },
  { iso2: 'ME', name: 'Montenegro', dialCode: '+382', flag: '🇲🇪', minDigits: 8, maxDigits: 8, example: '67 622 901' },
  { iso2: 'MA', name: 'Morocco', dialCode: '+212', flag: '🇲🇦', minDigits: 9, maxDigits: 9, example: '650 123456' },
  { iso2: 'MZ', name: 'Mozambique', dialCode: '+258', flag: '🇲🇿', minDigits: 9, maxDigits: 9, example: '82 123 4567' },
  { iso2: 'MM', name: 'Myanmar', dialCode: '+95', flag: '🇲🇲', minDigits: 8, maxDigits: 10, example: '9 212 3456' },
  { iso2: 'NA', name: 'Namibia', dialCode: '+264', flag: '🇳🇦', minDigits: 8, maxDigits: 9, example: '81 123 4567' },
  { iso2: 'NP', name: 'Nepal', dialCode: '+977', flag: '🇳🇵', minDigits: 10, maxDigits: 10, example: '984 1234567' },
  { iso2: 'NL', name: 'Netherlands', dialCode: '+31', flag: '🇳🇱', minDigits: 9, maxDigits: 9, example: '6 12345678' },
  { iso2: 'NZ', name: 'New Zealand', dialCode: '+64', flag: '🇳🇿', minDigits: 8, maxDigits: 10, example: '21 123 4567' },
  { iso2: 'NI', name: 'Nicaragua', dialCode: '+505', flag: '🇳🇮', minDigits: 8, maxDigits: 8, example: '8123 4567' },
  { iso2: 'NE', name: 'Niger', dialCode: '+227', flag: '🇳🇪', minDigits: 8, maxDigits: 8, example: '93 12 34 56' },
  { iso2: 'NG', name: 'Nigeria', dialCode: '+234', flag: '🇳🇬', minDigits: 10, maxDigits: 10, example: '802 123 4567' },
  { iso2: 'MK', name: 'North Macedonia', dialCode: '+389', flag: '🇲🇰', minDigits: 8, maxDigits: 8, example: '72 345 678' },
  { iso2: 'NO', name: 'Norway', dialCode: '+47', flag: '🇳🇴', minDigits: 8, maxDigits: 8, example: '406 12 345' },
  { iso2: 'PK', name: 'Pakistan', dialCode: '+92', flag: '🇵🇰', minDigits: 10, maxDigits: 10, example: '301 2345678' },
  { iso2: 'PS', name: 'Palestine', dialCode: '+970', flag: '🇵🇸', minDigits: 9, maxDigits: 9, example: '599 123 456' },
  { iso2: 'PA', name: 'Panama', dialCode: '+507', flag: '🇵🇦', minDigits: 7, maxDigits: 8, example: '6123 4567' },
  { iso2: 'PG', name: 'Papua New Guinea', dialCode: '+675', flag: '🇵🇬', minDigits: 8, maxDigits: 8, example: '7012 3456' },
  { iso2: 'PY', name: 'Paraguay', dialCode: '+595', flag: '🇵🇾', minDigits: 9, maxDigits: 9, example: '961 456789' },
  { iso2: 'PE', name: 'Peru', dialCode: '+51', flag: '🇵🇪', minDigits: 9, maxDigits: 9, example: '912 345 678' },
  { iso2: 'PH', name: 'Philippines', dialCode: '+63', flag: '🇵🇭', minDigits: 10, maxDigits: 10, example: '905 123 4567' },
  { iso2: 'PL', name: 'Poland', dialCode: '+48', flag: '🇵🇱', minDigits: 9, maxDigits: 9, example: '512 345 678' },
  { iso2: 'PT', name: 'Portugal', dialCode: '+351', flag: '🇵🇹', minDigits: 9, maxDigits: 9, example: '912 345 678' },
  { iso2: 'PR', name: 'Puerto Rico', dialCode: '+1787', flag: '🇵🇷', minDigits: 7, maxDigits: 7, example: '234 5678' },
  { iso2: 'RO', name: 'Romania', dialCode: '+40', flag: '🇷🇴', minDigits: 9, maxDigits: 9, example: '712 034 567' },
  { iso2: 'RU', name: 'Russia', dialCode: '+7', flag: '🇷🇺', minDigits: 10, maxDigits: 10, example: '912 345 67 89' },
  { iso2: 'RW', name: 'Rwanda', dialCode: '+250', flag: '🇷🇼', minDigits: 9, maxDigits: 9, example: '720 123 456' },
  { iso2: 'WS', name: 'Samoa', dialCode: '+685', flag: '🇼🇸', minDigits: 5, maxDigits: 7, example: '7212345' },
  { iso2: 'SM', name: 'San Marino', dialCode: '+378', flag: '🇸🇲', minDigits: 6, maxDigits: 10, example: '66 66 12 12' },
  { iso2: 'SN', name: 'Senegal', dialCode: '+221', flag: '🇸🇳', minDigits: 9, maxDigits: 9, example: '70 123 45 67' },
  { iso2: 'RS', name: 'Serbia', dialCode: '+381', flag: '🇷🇸', minDigits: 8, maxDigits: 9, example: '60 1234567' },
  { iso2: 'SC', name: 'Seychelles', dialCode: '+248', flag: '🇸🇨', minDigits: 7, maxDigits: 7, example: '2 510 123' },
  { iso2: 'SL', name: 'Sierra Leone', dialCode: '+232', flag: '🇸🇱', minDigits: 8, maxDigits: 8, example: '25 123456' },
  { iso2: 'SG', name: 'Singapore', dialCode: '+65', flag: '🇸🇬', minDigits: 8, maxDigits: 8, example: '8123 4567' },
  { iso2: 'SK', name: 'Slovakia', dialCode: '+421', flag: '🇸🇰', minDigits: 9, maxDigits: 9, example: '912 123 456' },
  { iso2: 'SI', name: 'Slovenia', dialCode: '+386', flag: '🇸🇮', minDigits: 8, maxDigits: 8, example: '31 234 567' },
  { iso2: 'SO', name: 'Somalia', dialCode: '+252', flag: '🇸🇴', minDigits: 7, maxDigits: 9, example: '7 1123456' },
  { iso2: 'ZA', name: 'South Africa', dialCode: '+27', flag: '🇿🇦', minDigits: 9, maxDigits: 9, example: '71 123 4567' },
  { iso2: 'SS', name: 'South Sudan', dialCode: '+211', flag: '🇸🇸', minDigits: 9, maxDigits: 9, example: '977 123 456' },
  { iso2: 'ES', name: 'Spain', dialCode: '+34', flag: '🇪🇸', minDigits: 9, maxDigits: 9, example: '612 34 56 78' },
  { iso2: 'LK', name: 'Sri Lanka', dialCode: '+94', flag: '🇱🇰', minDigits: 9, maxDigits: 9, example: '71 234 5678' },
  { iso2: 'SD', name: 'Sudan', dialCode: '+249', flag: '🇸🇩', minDigits: 9, maxDigits: 9, example: '91 123 1234' },
  { iso2: 'SR', name: 'Suriname', dialCode: '+597', flag: '🇸🇷', minDigits: 6, maxDigits: 7, example: '741 2345' },
  { iso2: 'SE', name: 'Sweden', dialCode: '+46', flag: '🇸🇪', minDigits: 7, maxDigits: 10, example: '70 123 45 67' },
  { iso2: 'CH', name: 'Switzerland', dialCode: '+41', flag: '🇨🇭', minDigits: 9, maxDigits: 9, example: '78 123 45 67' },
  { iso2: 'SY', name: 'Syria', dialCode: '+963', flag: '🇸🇾', minDigits: 9, maxDigits: 9, example: '944 567 890' },
  { iso2: 'TW', name: 'Taiwan', dialCode: '+886', flag: '🇹🇼', minDigits: 9, maxDigits: 9, example: '912 345 678' },
  { iso2: 'TJ', name: 'Tajikistan', dialCode: '+992', flag: '🇹🇯', minDigits: 9, maxDigits: 9, example: '917 12 3456' },
  { iso2: 'TZ', name: 'Tanzania', dialCode: '+255', flag: '🇹🇿', minDigits: 9, maxDigits: 9, example: '621 234 567' },
  { iso2: 'TH', name: 'Thailand', dialCode: '+66', flag: '🇹🇭', minDigits: 8, maxDigits: 9, example: '81 234 5678' },
  { iso2: 'TG', name: 'Togo', dialCode: '+228', flag: '🇹🇬', minDigits: 8, maxDigits: 8, example: '90 11 23 45' },
  { iso2: 'TT', name: 'Trinidad and Tobago', dialCode: '+1868', flag: '🇹🇹', minDigits: 7, maxDigits: 7, example: '291 1234' },
  { iso2: 'TN', name: 'Tunisia', dialCode: '+216', flag: '🇹🇳', minDigits: 8, maxDigits: 8, example: '20 123 456' },
  { iso2: 'TR', name: 'Turkey', dialCode: '+90', flag: '🇹🇷', minDigits: 10, maxDigits: 10, example: '501 234 56 78' },
  { iso2: 'TM', name: 'Turkmenistan', dialCode: '+993', flag: '🇹🇲', minDigits: 8, maxDigits: 8, example: '66 123456' },
  { iso2: 'UG', name: 'Uganda', dialCode: '+256', flag: '🇺🇬', minDigits: 9, maxDigits: 9, example: '712 345678' },
  { iso2: 'UA', name: 'Ukraine', dialCode: '+380', flag: '🇺🇦', minDigits: 9, maxDigits: 9, example: '50 123 4567' },
  { iso2: 'UY', name: 'Uruguay', dialCode: '+598', flag: '🇺🇾', minDigits: 8, maxDigits: 8, example: '94 231 234' },
  { iso2: 'UZ', name: 'Uzbekistan', dialCode: '+998', flag: '🇺🇿', minDigits: 9, maxDigits: 9, example: '91 234 56 78' },
  { iso2: 'VE', name: 'Venezuela', dialCode: '+58', flag: '🇻🇪', minDigits: 10, maxDigits: 10, example: '412 1234567' },
  { iso2: 'VN', name: 'Vietnam', dialCode: '+84', flag: '🇻🇳', minDigits: 9, maxDigits: 10, example: '91 234 56 78' },
  { iso2: 'YE', name: 'Yemen', dialCode: '+967', flag: '🇾🇪', minDigits: 9, maxDigits: 9, example: '712 345 678' },
  { iso2: 'ZM', name: 'Zambia', dialCode: '+260', flag: '🇿🇲', minDigits: 9, maxDigits: 9, example: '95 5123456' },
  { iso2: 'ZW', name: 'Zimbabwe', dialCode: '+263', flag: '🇿🇼', minDigits: 9, maxDigits: 9, example: '71 234 5678' },
];

export function findCountryByIso(iso2: string): CountryCodeOption {
  const clean = String(iso2 || '').trim().toUpperCase();
  return (
    COUNTRY_CODES.find((c) => c.iso2 === clean) ??
    COUNTRY_CODES[0]
  );
}

const E164_REGEX = /^\+[1-9]\d{6,14}$/;

export function formatAndValidatePhone(
  iso2: string,
  rawLocal: string,
): { valid: boolean; e164: string; nationalDigits: string; error?: string } {
  const country = findCountryByIso(iso2);
  const dialDigits = country.dialCode.replace(/\D/g, '');
  const trimmed = String(rawLocal || '').trim();

  if (!trimmed) {
    return {
      valid: false,
      e164: '',
      nationalDigits: '',
      error: `Please enter a phone number for ${country.name} (${country.dialCode}).`,
    };
  }

  let digits = trimmed.replace(/\D/g, '');

  // Handle pasted full international numbers (+966... or 00966...)
  if (trimmed.startsWith('+') && digits.startsWith(dialDigits)) {
    digits = digits.slice(dialDigits.length);
  } else if (trimmed.startsWith('00') && digits.startsWith(`00${dialDigits}`)) {
    digits = digits.slice(2 + dialDigits.length);
  }

  // Strip national trunk '0' when user types local leading 0 (e.g., 050 123 4567 -> 50 123 4567)
  if (digits.startsWith('0') && digits.length > country.minDigits) {
    digits = digits.replace(/^0+/, '');
  }

  if (!digits || /^0+$/.test(digits)) {
    return {
      valid: false,
      e164: '',
      nationalDigits: digits,
      error: `Enter a valid ${country.name} number (e.g. ${country.dialCode} ${country.example}).`,
    };
  }

  if (digits.length < country.minDigits || digits.length > country.maxDigits) {
    const lengthLabel =
      country.minDigits === country.maxDigits
        ? `${country.minDigits} digits`
        : `${country.minDigits}–${country.maxDigits} digits`;
    return {
      valid: false,
      e164: '',
      nationalDigits: digits,
      error: `${country.name} numbers must be ${lengthLabel} after ${country.dialCode} (e.g. ${country.example}).`,
    };
  }

  const e164 = `+${dialDigits}${digits}`;
  if (!E164_REGEX.test(e164)) {
    return {
      valid: false,
      e164: '',
      nationalDigits: digits,
      error: `Phone number exceeds maximum international length.`,
    };
  }

  return {
    valid: true,
    e164,
    nationalDigits: digits,
  };
}
