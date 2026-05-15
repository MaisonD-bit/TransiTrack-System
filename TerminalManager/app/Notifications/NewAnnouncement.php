<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class NewAnnouncement extends Notification
{
    use Queueable;

    protected $announcement;

    public function __construct($announcement)
    {
        $this->announcement = $announcement;
    }

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->line('A new announcement has been posted.')
            ->action('View Announcement', url('/announcements/' . $this->announcement->id))
            ->line('Thank you for using TransiTrack.');
    }

    public function toDatabase(object $notifiable)
    {
        return [
            'message' => 'New announcement from ' . ($this->announcement->sender->name ?? 'Terminal Manager'),
            'subject' => $this->announcement->subject ?? 'No subject',
            'announcement_id' => $this->announcement->id,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [];
    }
}
