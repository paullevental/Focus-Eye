import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
import numpy as np
import os
from sklearn.model_selection import train_test_split

# Parameters
SEQUENCE_LENGTH = 30
INPUT_SIZE = 468 * 3  # 468 landmarks * (x, y, z)
HIDDEN_SIZE = 64 
NUM_CLASSES = 3
NUM_LAYERS = 5
BATCH_SIZE = 32
EPOCHS = 50
LEARNING_RATE = 0.001

class FocusDataset(Dataset):
    def __init__(self, X, y):
        self.X = torch.tensor(X, dtype=torch.float32)
        self.y = torch.tensor(y, dtype=torch.long)
        
    def __len__(self):
        return len(self.X)
        
    def __getitem__(self, idx):
        return self.X[idx], self.y[idx]

class FocusLSTM(nn.Module):
    def __init__(self, input_size, hidden_size, num_layers, num_classes):
        super(FocusLSTM, self).__init__()
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers, batch_first=True, dropout=0.2)
        self.fc = nn.Linear(hidden_size, num_classes)
        
    def forward(self, x):
        h0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size).to(x.device)
        c0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size).to(x.device)
        
        out, _ = self.lstm(x, (h0, c0))
        out = self.fc(out[:, -1, :])  # Take the last time step
        return out

def load_data(data_path):
    X = []
    y = []
    classes = ["Deep Focus", "Partial Distraction", "Absent"]
    
    for file in os.listdir(data_path):
        if file.endswith(".npy"):
            label_str = file.split("_")[0]
            if label_str in classes:
                label = classes.index(label_str)
                data = np.load(os.path.join(data_path, file))
                if data.shape == (SEQUENCE_LENGTH, INPUT_SIZE):
                    X.append(data)
                    y.append(label)
                else:
                    print(f"Skipping {file} due to shape mismatch: {data.shape}")
                    
    return np.array(X), np.array(y)

def train():
    data_path = "ai/data/raw"
    if not os.listdir(data_path):
        print("No data found in ai/data/raw. Please run collect_data.py first.")
        return

    X, y = load_data(data_path)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    train_dataset = FocusDataset(X_train, y_train)
    test_dataset = FocusDataset(X_test, y_test)
    
    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True)
    test_loader = DataLoader(test_dataset, batch_size=BATCH_SIZE, shuffle=False)
    
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model = FocusLSTM(INPUT_SIZE, HIDDEN_SIZE, NUM_LAYERS, NUM_CLASSES).to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=LEARNING_RATE)
    
    for epoch in range(EPOCHS):
        model.train()
        total_loss = 0
        for batch_X, batch_y in train_loader:
            batch_X, batch_y = batch_X.to(device), batch_y.to(device)
            
            outputs = model(batch_X)
            loss = criterion(outputs, batch_y)
            
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            total_loss += loss.item()
            
        print(f"Epoch [{epoch+1}/{EPOCHS}], Loss: {total_loss/len(train_loader):.4f}")
        
    # Evaluation
    model.eval()
    with torch.no_grad():
        correct = 0
        total = 0
        for batch_X, batch_y in test_loader:
            batch_X, batch_y = batch_X.to(device), batch_y.to(device)
            outputs = model(batch_X)
            _, predicted = torch.max(outputs.data, 1)
            total += batch_y.size(0)
            correct += (predicted == batch_y).sum().item()
            
        print(f"Test Accuracy: {100 * correct / total:.2f}%")
        
    # Save model
    if not os.path.exists("ai/models"):
        os.makedirs("ai/models")
    torch.save(model.state_dict(), "ai/models/focus_lstm.pth")
    print("Model saved to ai/models/focus_lstm.pth")

if __name__ == "__main__":
    train()
