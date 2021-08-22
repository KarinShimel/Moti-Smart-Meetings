# Moti - Smart Meetings App
Moti is designed to help everyone create social meetings faster, and being headache free.

Our meeting creation process is fast and easy, whilst using a ML suggester agent to upgrade each user's exprience.


![](/ScreenShots/Login.gif)      ![](/ScreenShots/MainScreen.png)

## Technologies
- Since Moti is a social app, we want to be approachable to all users.<br />
iOS & Android support - React-Native App.

- Integration with Firebase for the cloud DB, storage and authentication capabilities.

- Our server is a HTTP python server, that implements ML algorithms (like K-means).<br />
  Our suggestions occur once a day, and consist of 2 main suggestions:
  1) Birthday suggestions:<br />
  Each user is offered a choice whether or not to sync up calendars with out app.
  When approved, every birthday saved in the calendar is then saved into our DB, and when the time comes, Moti will suggest a meeting to celebrate!

  2) Smart suggestions based on the user's past meetings:<br />
  For each user, we scan the past meetings and start a process of creating centroids, which are then converted into clusters based on a similarity score - based on an NLP library that weights in the text scemantics and context.
  Finding the cluster most relevant to the present time, and suggesting a meeting similar to the highest scored cluster.
- Look for a place: <br />
  Moti is also using Google Places API to find relevant places for meetings to take place. Every user can enter minimal search parameters and Moti will provide a list of places/activites relevant to the users input, then the user can create a meeting in the chosen spot. 
  
- Calendar Integration:.<br />
  Add the meetings you create to your personal calendar.

More features available! <br />
Download and check them out :)

## Examples:

![](/ScreenShots/CrateMeet.gif)
