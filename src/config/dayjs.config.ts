import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

// Configure dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);

// Set default timezone
dayjs.tz.setDefault('Asia/Manila');

// Export the configured dayjs instance
export default dayjs;
