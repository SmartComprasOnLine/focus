require('dotenv').config();
const moment = require('moment-timezone');

class TimezoneService {
    constructor() {
        this.timezone = process.env.TIMEZONE || 'America/Sao_Paulo';
    }

    getCurrentTime() {
        return moment().tz(this.timezone);
    }

    formatDate(date) {
        return moment(date).tz(this.timezone).format('DD/MM/YYYY HH:mm:ss');
    }

    formatDateOnly(date) {
        return moment(date).tz(this.timezone).format('DD/MM/YYYY');
    }

    formatTimeOnly(date) {
        return moment(date).tz(this.timezone).format('HH:mm:ss');
    }

    addDays(date, days) {
        return moment(date).tz(this.timezone).add(days, 'days').toDate();
    }

    addMonths(date, months) {
        return moment(date).tz(this.timezone).add(months, 'months').toDate();
    }

    addYears(date, years) {
        return moment(date).tz(this.timezone).add(years, 'years').toDate();
    }

    startOfDay(date) {
        return moment(date).tz(this.timezone).startOf('day').toDate();
    }

    endOfDay(date) {
        return moment(date).tz(this.timezone).endOf('day').toDate();
    }

    getDaysBetween(startDate, endDate) {
        const start = moment(startDate).tz(this.timezone).startOf('day');
        const end = moment(endDate).tz(this.timezone).startOf('day');
        return end.diff(start, 'days');
    }

    isBeforeNow(date) {
        return moment(date).tz(this.timezone).isBefore(this.getCurrentTime());
    }

    isAfterNow(date) {
        return moment(date).tz(this.timezone).isAfter(this.getCurrentTime());
    }

    parseUserTime(timeString) {
        return moment.tz(timeString, 'HH:mm', this.timezone);
    }

    getNextOccurrence(timeString) {
        const now = this.getCurrentTime();
        const todayOccurrence = this.parseUserTime(timeString);
        
        if (todayOccurrence.isAfter(now)) {
            return todayOccurrence.toDate();
        }
        
        return todayOccurrence.add(1, 'day').toDate();
    }
}

module.exports = new TimezoneService();
