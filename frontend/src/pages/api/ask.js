export default async function handler(req, res) {
	if (req.method === 'POST') {
		const userQuery = req.body.query;

		// Make a request to your Flask backend
		const response = await fetch('https://your-flask-backend.herokuapp.com/ask', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ question: userQuery }),
		});

		const data = await response.json();
		res.status(200).json(data);
	} else {
		res.status(405).json({ message: 'Method Not Allowed' });
	}
}
