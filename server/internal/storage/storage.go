package storage

import (
	"bytes"
	"context"
	"drawer-service-backend/internal/config"
	"fmt"
	"log"

	"github.com/aws/aws-sdk-go-v2/aws"
	s3Config "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type StorageService struct {
	client *s3.Client
	bucketName string
	region string
}

func NewStorageService(cfg *config.Config) *StorageService {
	context := context.TODO()
	region := s3Config.WithRegion(cfg.S3BucketRegion)
	s3cfg, err := s3Config.LoadDefaultConfig(context, region)

	if err != nil {
		log.Fatal("Unable to load SDK config:", err)
	}

	s3Client := s3.NewFromConfig(s3cfg)

	return &StorageService {
		client: s3Client,
		bucketName: cfg.S3BucketName,
		region: cfg.S3BucketRegion,
	}
}

func (s *StorageService) UploadImage(userId string, submissionId string, imageData []byte) (string, error) {
	filename := getImageFilename(userId, submissionId)
	_, err := s.client.PutObject(context.TODO(), &s3.PutObjectInput{
		Bucket:      aws.String(s.bucketName),
		Key:         aws.String(filename),
		Body:        bytes.NewReader(imageData),
		ContentType: aws.String("image/png"),
	})

	if err != nil {
		log.Printf("Failed to upload image to s3: %v", err)
		return "", err
	}

	return s.getUploadURL(filename), nil
}

func (s *StorageService) getUploadURL(imageName string) string {
	return fmt.Sprintf("https://%s.s3.%s.amazonaws.com/%s", s.bucketName, s.region, imageName)
}

func getImageFilename(userId string, submissionId string) string {
	return fmt.Sprintf("%s/%s.png", userId, submissionId)
}
