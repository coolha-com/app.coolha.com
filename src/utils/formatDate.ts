'use client'

export const formatDate = (isoDate) => {
    const date = new Date(isoDate);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export function timeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const secondsPast = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (secondsPast < 60) {
        return '刚刚';
    }
    const minutesPast = Math.floor(secondsPast / 60);
    if (minutesPast < 60) {
        return `${minutesPast}分钟前`;
    }
    const hoursPast = Math.floor(minutesPast / 60);
    if (hoursPast < 24) {
        return `${hoursPast}小时前`;
    }
    const daysPast = Math.floor(hoursPast / 24);
    if (daysPast < 30) {
        return `${date.getMonth() + 1}月${date.getDate()}日`;
    }
    const monthsPast = Math.floor(daysPast / 30);
    if (monthsPast < 12) {
        return `${date.getMonth() + 1}月${date.getDate()}日`;
    }
    const yearsPast = Math.floor(monthsPast / 12);
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

// Example usage:
//const isoDateString = '2024-06-03T14:42:36.000Z';

